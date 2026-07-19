import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// meshEstimate.worker.ts — Phase 44 Plan 05 Task 1.
//
// The worker dynamic-imports three/addons (STLLoader, ThreeMFLoader) so it
// stays out of the main bundle (assert-no-static-three-import.mjs). These
// mocks stand in for the real three.js loaders — jsdom has no WebGL/DOM
// canvas support, and the pure-math result (volume/area/bbox/manifold) is
// already covered by stlParser.test.ts, so these tests only need to prove
// the worker's parse->math->message-shape wiring and the multi-object 3MF
// sum, not re-derive the geometry math.
// ---------------------------------------------------------------------------

/** The 12-triangle cube face list — same fixture shape as stlParser.test.ts. */
const CUBE_TRIANGLES: Array<[string, string, string]> = [
  ['E', 'F', 'G'], ['E', 'G', 'H'],
  ['B', 'A', 'D'], ['B', 'D', 'C'],
  ['B', 'C', 'G'], ['B', 'G', 'F'],
  ['A', 'E', 'H'], ['A', 'H', 'D'],
  ['D', 'H', 'G'], ['D', 'G', 'C'],
  ['A', 'B', 'F'], ['A', 'F', 'E'],
];

const CUBE_VERTICES: Record<string, [number, number, number]> = {
  A: [0, 0, 0], B: [1, 0, 0], C: [1, 1, 0], D: [0, 1, 0],
  E: [0, 0, 1], F: [1, 0, 1], G: [1, 1, 1], H: [0, 1, 1],
};

function buildWatertightCube(size = 10): Float32Array {
  const floats: number[] = [];
  for (const tri of CUBE_TRIANGLES) {
    for (const label of tri) {
      const [x, y, z] = CUBE_VERTICES[label];
      floats.push(x * size, y * size, z * size);
    }
  }
  return new Float32Array(floats);
}

vi.mock('three/addons/loaders/STLLoader.js', () => ({
  STLLoader: class {
    parse(buffer: ArrayBuffer) {
      return {
        index: null,
        attributes: { position: { array: new Float32Array(buffer), itemSize: 3 } },
      };
    }
  },
}));

vi.mock('three/addons/loaders/3MFLoader.js', () => ({
  ThreeMFLoader: class {
    parse(buffer: ArrayBuffer) {
      // Simulate a 2-object 3MF Group: split the buffer's triangles across
      // two "meshes" (Open Question 2 default — sum all, surface count).
      const view = new Float32Array(buffer);
      const half = Math.floor(view.length / 2 / 9) * 9; // triangle-aligned split
      const meshes = [
        { isMesh: true, geometry: { index: null, attributes: { position: { array: view.subarray(0, half) } } } },
        { isMesh: true, geometry: { index: null, attributes: { position: { array: view.subarray(half) } } } },
      ];
      return {
        traverse(cb: (obj: unknown) => void) {
          meshes.forEach(cb);
        },
      };
    }
  },
}));

describe('meshEstimate.worker computeMeshFromBuffer', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('parses an STL buffer into volume/area/bbox/manifold + position (kind: stl)', async () => {
    const { computeMeshFromBuffer } = await import('./meshEstimate.worker');
    const cube = buildWatertightCube(10);
    const result = await computeMeshFromBuffer({ buffer: cube.buffer, kind: 'stl' });

    expect(result.volumeCm3).toBeCloseTo(1.0, 3);
    expect(result.surfaceAreaCm2).toBeCloseTo(6.0, 3);
    expect(result.boundingBoxMm.size).toEqual({ x: 10, y: 10, z: 10 });
    expect(result.isNonManifold).toBe(false);
    expect(result.objectCount).toBe(1);
    expect(result.position).toBeInstanceOf(Float32Array);
    expect(result.position.length).toBe(cube.length);
  });

  it('sums volume/area across all mesh geometries in a multi-object 3MF Group and reports object count', async () => {
    const { computeMeshFromBuffer } = await import('./meshEstimate.worker');
    const cube = buildWatertightCube(10);
    const result = await computeMeshFromBuffer({ buffer: cube.buffer, kind: '3mf' });

    // The mocked ThreeMFLoader splits the same cube buffer across 2 meshes;
    // merging them back reconstructs the original triangle soup exactly, so
    // the summed geometry math must match the single-object cube result.
    expect(result.objectCount).toBe(2);
    expect(result.position.length).toBe(cube.length);
    expect(result.volumeCm3).toBeCloseTo(1.0, 3);
    expect(result.surfaceAreaCm2).toBeCloseTo(6.0, 3);
  });

  it('rejects an oversized STL buffer before parsing (T-44-05-01)', async () => {
    const { computeMeshFromBuffer, MAX_STL_BYTES } = await import('./meshEstimate.worker');
    const oversized = new ArrayBuffer(MAX_STL_BYTES + 1);

    await expect(computeMeshFromBuffer({ buffer: oversized, kind: 'stl' })).rejects.toThrow(/too large/i);
  });

  it('rejects an oversized 3MF buffer before parsing (T-44-05-01, mirrors MAX_THREE_MF_BYTES)', async () => {
    const { computeMeshFromBuffer, MAX_MESH_THREE_MF_BYTES } = await import('./meshEstimate.worker');
    const oversized = new ArrayBuffer(MAX_MESH_THREE_MF_BYTES + 1);

    await expect(computeMeshFromBuffer({ buffer: oversized, kind: '3mf' })).rejects.toThrow(/too large/i);
  });

  it('never statically imports three — only via dynamic import()', async () => {
    // Structural guard mirrored by the acceptance-criteria grep, kept here too
    // so a regression fails the test suite, not just a separate CI script.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.join(process.cwd(), 'src/workers/meshEstimate.worker.ts');
    const source = await fs.readFile(filePath, 'utf-8');
    expect(source).toMatch(/await import\('three/);
    expect(source).not.toMatch(/^import.*from 'three'/m);
  });
});

describe('meshEstimate.worker computeMeshFromBuffer — never blocks the main thread', () => {
  it('lets a concurrent interval keep firing while a slow-resolving parse import is in flight', async () => {
    vi.resetModules();
    vi.doMock('three/addons/loaders/STLLoader.js', async () => {
      // Simulate a real dynamic-import/parse taking wall-clock time (a large
      // model). If the worker synchronously blocked the thread for this
      // duration, no other macrotask (the interval below) could run during
      // it — proving the async/dynamic-import structure yields control back
      // to the event loop instead of monopolizing it.
      await new Promise(resolve => setTimeout(resolve, 30));
      return {
        STLLoader: class {
          parse(buffer: ArrayBuffer) {
            return {
              index: null,
              attributes: { position: { array: new Float32Array(buffer), itemSize: 3 } },
            };
          }
        },
      };
    });

    const { computeMeshFromBuffer } = await import('./meshEstimate.worker');
    const cube = buildWatertightCube(10);

    let ticks = 0;
    const interval = setInterval(() => { ticks += 1; }, 5);

    await computeMeshFromBuffer({ buffer: cube.buffer, kind: 'stl' });

    clearInterval(interval);
    expect(ticks).toBeGreaterThan(0);
  });
});

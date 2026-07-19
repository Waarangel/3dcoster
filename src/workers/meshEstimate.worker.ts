// ---------------------------------------------------------------------------
// meshEstimate.worker.ts — off-thread STL/3MF mesh parse + geometry math
// (Phase 44 Plan 05, CONN-02).
//
// Runs the three.js STLLoader/ThreeMFLoader parse plus the pure stlParser
// geometry math (volume, surface area, bounding box, non-manifold) inside a
// dedicated module Worker so a large model parse never blocks the main
// thread (CONN-02's "never blocks the main thread" lock).
//
// `three` is imported ONLY via dynamic import() here — never a static
// top-level import — so this worker (and the three chunk it pulls in) stays
// entirely out of the main bundle. assert-no-static-three-import.mjs (44-02)
// fails the build on any regression. The worker never imports three's own
// TYPES statically either (`import type {...} from 'three'`) — those local
// Minimal* interfaces below describe just the shape this file touches, so no
// `from 'three'` import line exists anywhere in this source file.
//
// This file is intentionally structured around one exported, directly
// testable async function (computeMeshFromBuffer) — the actual
// `self.onmessage` registration is a thin wrapper around it. That keeps the
// parse/math logic unit-testable without needing to instantiate a real
// Worker (jsdom has no worker-thread support).
// ---------------------------------------------------------------------------

import { computeMeshEstimate } from '../utils/stlParser';
import type { MeshGeometryResult } from '../utils/stlParser';

/**
 * Raw-byte size cap for an .stl buffer before parse — mirrors the 200 MB
 * MAX_THREE_MF_BYTES precedent (GcodeImport.tsx / threeMfParser.ts) so both
 * mesh-estimate entry points share the same DoS ceiling (T-44-05-01).
 */
export const MAX_STL_BYTES = 200 * 1024 * 1024;

/**
 * Raw-byte size cap for a non-sliced .3mf buffer before parse — mirrors
 * threeMfParser.ts's MAX_THREE_MF_BYTES exactly (same 200 MB ceiling); this
 * is a SEPARATE constant (not a shared import) because the mesh worker path
 * is a distinct entry point from the sliced-3MF/jszip path and must not
 * couple its size guard to that module's internals (T-44-05-01).
 */
export const MAX_MESH_THREE_MF_BYTES = 200 * 1024 * 1024;

export interface MeshEstimateWorkerInput {
  buffer: ArrayBuffer;
  kind: 'stl' | '3mf';
}

export interface MeshEstimateWorkerOutput extends MeshGeometryResult {
  /** Number of mesh objects summed (1 for STL; >=1 for a multi-object 3MF Group). */
  objectCount: number;
  /** Merged, non-indexed triangle-soup position buffer, for the main-thread preview render. */
  position: Float32Array;
}

export type MeshEstimateWorkerMessage =
  | { type: 'result'; data: MeshEstimateWorkerOutput }
  | { type: 'error'; message: string };

/** Structural subset of THREE.BufferGeometry this worker touches (no `from 'three'` type import). */
interface MinimalBufferGeometry {
  index: { array: ArrayLike<number> } | null;
  attributes: { position: { array: Float32Array; itemSize: number } };
  toNonIndexed?: () => MinimalBufferGeometry;
}

/** Structural subset of THREE.Mesh. */
interface MinimalMesh {
  isMesh?: boolean;
  geometry?: MinimalBufferGeometry;
}

/** Structural subset of THREE.Group — ThreeMFLoader.parse() return shape. */
interface MinimalGroup {
  traverse: (callback: (obj: MinimalMesh) => void) => void;
}

/**
 * Returns the geometry's position buffer as a non-indexed (raw triangle
 * soup) Float32Array — the shape stlParser.ts's pure math consumes. Indexed
 * geometries are expanded via toNonIndexed() when present.
 */
function toNonIndexedPositions(geometry: MinimalBufferGeometry): Float32Array {
  if (geometry.index && geometry.toNonIndexed) {
    return geometry.toNonIndexed().attributes.position.array;
  }
  return geometry.attributes.position.array;
}

/**
 * Sums the non-indexed position buffers of every Mesh descendant of a 3MF
 * Group and reports how many objects were summed (Open Question 2 default:
 * sum all mesh geometries, surface the object count — RESEARCH.md).
 */
function extractGroupPositions(group: MinimalGroup): { position: Float32Array; objectCount: number } {
  const chunks: Float32Array[] = [];
  let objectCount = 0;

  group.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      chunks.push(toNonIndexedPositions(obj.geometry));
      objectCount += 1;
    }
  });

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return { position: merged, objectCount };
}

function assertWithinSizeCap(byteLength: number, kind: MeshEstimateWorkerInput['kind']): void {
  const cap = kind === 'stl' ? MAX_STL_BYTES : MAX_MESH_THREE_MF_BYTES;
  if (byteLength > cap) {
    const sizeMb = (byteLength / 1024 / 1024).toFixed(1);
    const capMb = (cap / 1024 / 1024).toFixed(0);
    const label = kind === 'stl' ? 'STL' : '3MF';
    throw new Error(`${label} file is too large (${sizeMb} MB). Maximum is ${capMb} MB.`);
  }
}

/**
 * Parses an STL or non-sliced-3MF ArrayBuffer off the main thread and
 * computes the volume/area/bbox/non-manifold estimate plus the merged
 * preview position buffer. Exported directly for unit testing — the
 * `self.onmessage` handler below is a thin postMessage wrapper around this.
 */
export async function computeMeshFromBuffer(input: MeshEstimateWorkerInput): Promise<MeshEstimateWorkerOutput> {
  const { buffer, kind } = input;
  assertWithinSizeCap(buffer.byteLength, kind);

  let position: Float32Array;
  let objectCount: number;

  if (kind === 'stl') {
    const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
    const geometry = new STLLoader().parse(buffer) as unknown as MinimalBufferGeometry;
    position = toNonIndexedPositions(geometry);
    objectCount = 1;
  } else {
    const { ThreeMFLoader } = await import('three/addons/loaders/3MFLoader.js');
    const group = new ThreeMFLoader().parse(buffer) as unknown as MinimalGroup;
    const extracted = extractGroupPositions(group);
    position = extracted.position;
    objectCount = extracted.objectCount;
  }

  const estimate = computeMeshEstimate(position);

  return {
    ...estimate,
    objectCount,
    position,
  };
}

// Worker entry point. Only meaningful inside a real DedicatedWorkerGlobalScope
// (module worker); under Vitest/jsdom `self` aliases `window`, so this
// assignment is inert there and the module stays freely importable for
// direct unit testing of computeMeshFromBuffer above.
self.onmessage = async (e: MessageEvent<MeshEstimateWorkerInput>) => {
  try {
    const result = await computeMeshFromBuffer(e.data);
    const message: MeshEstimateWorkerMessage = { type: 'result', data: result };
    (self as unknown as Worker).postMessage(message, [result.position.buffer]);
  } catch (err) {
    const message: MeshEstimateWorkerMessage = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Failed to parse mesh file',
    };
    (self as unknown as Worker).postMessage(message);
  }
};

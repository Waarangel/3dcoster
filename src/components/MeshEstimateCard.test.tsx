import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MeshEstimateCard } from './MeshEstimateCard';
import type { MeshEstimateWorkerOutput } from '../workers/meshEstimate.worker';
import type { Asset } from '../types';

// ---------------------------------------------------------------------------
// MeshEstimateCard — Phase 44 Plan 05 Task 2. Raw createRoot + act per
// project precedent (LogMaintenanceModal.test.tsx) — no @testing-library
// dependency in this repo.
//
// These tests cover the non-visual behavior only (disclaimer, infill default
// + recompute, Apply wiring, no-apply-on-mount). The WebGL preview
// render/rotate is verified in the Task 4 human-verify checkpoint, so `three`
// and its OrbitControls addon are mocked here purely to keep the preview
// useEffect from touching real WebGL (jsdom has no GPU/canvas context).
// ---------------------------------------------------------------------------

vi.mock('three', () => {
  class Vector3 {
    x = 0; y = 0; z = 0;
    set() { return this; }
    copy() { return this; }
  }
  class Box3 {
    setFromObject() { return this; }
    getSize() { return new Vector3(); }
    getCenter() { return new Vector3(); }
  }
  class BufferGeometry {
    setAttribute() { return this; }
    computeVertexNormals() { /* no-op */ }
  }
  return {
    Scene: class { add() { /* no-op */ } },
    PerspectiveCamera: class {
      position = new Vector3();
      near = 0.1;
      far = 10000;
      lookAt() { /* no-op */ }
      updateProjectionMatrix() { /* no-op */ }
    },
    BufferGeometry,
    BufferAttribute: class {},
    MeshStandardMaterial: class {},
    Mesh: class {},
    AmbientLight: class {},
    DirectionalLight: class { position = new Vector3(); },
    Box3,
    Vector3,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      setSize() { /* no-op */ }
      setPixelRatio() { /* no-op */ }
      render() { /* no-op */ }
      dispose() { /* no-op */ }
    },
  };
});

vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    target = { copy: () => {} };
    update() { /* no-op */ }
    dispose() { /* no-op */ }
  },
}));

/** Same 12-triangle watertight-cube fixture shape as stlParser.test.ts / meshEstimate.worker.test.ts. */
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
function buildCube(size = 10): Float32Array {
  const floats: number[] = [];
  for (const tri of CUBE_TRIANGLES) {
    for (const label of tri) {
      const [x, y, z] = CUBE_VERTICES[label];
      floats.push(x * size, y * size, z * size);
    }
  }
  return new Float32Array(floats);
}

const ESTIMATE: MeshEstimateWorkerOutput = {
  volumeCm3: 1,
  surfaceAreaCm2: 6,
  boundingBoxMm: {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 10, y: 10, z: 10 },
    size: { x: 10, y: 10, z: 10 },
  },
  isNonManifold: false,
  objectCount: 1,
  position: buildCube(10),
};

const FILAMENT: Asset = {
  id: 'fil-1',
  name: 'Bambu PLA Basic',
  category: 'filament',
  costPerUnit: 0.02,
  currency: 'USD',
  filamentType: 'PLA',
} as Asset;

let container: HTMLDivElement;
let root: Root;

function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderCard(
  onApply = vi.fn(),
  onDismiss = vi.fn(),
  estimate: MeshEstimateWorkerOutput = ESTIMATE,
  selectedFilament: Asset | null = FILAMENT,
) {
  act(() => {
    root.render(
      <MeshEstimateCard
        fileName="dragon.stl"
        estimate={estimate}
        selectedFilament={selectedFilament}
        userCurrency="USD"
        currencySymbol="$"
        onApply={onApply}
        onDismiss={onDismiss}
      />
    );
  });
  return { onApply, onDismiss };
}

function getInfillInput(): HTMLInputElement {
  return [...document.body.querySelectorAll('input')].find(
    i => i.type === 'number' && Number(i.value) === 15
  ) as HTMLInputElement;
}

function getTotalGrams(): number {
  const el = document.body.querySelector('[data-testid="mesh-estimate-total-grams"]');
  return Number(el?.getAttribute('data-grams'));
}

describe('MeshEstimateCard', () => {
  it('shows the review-before-quoting disclaimer', () => {
    renderCard();
    expect(document.body.textContent).toContain('review before quoting');
  });

  it('defaults the infill input to 15% and persists it under stl-estimate-infill', () => {
    renderCard();
    const infillInput = getInfillInput();
    expect(infillInput).toBeTruthy();
    expect(localStorage.getItem('stl-estimate-infill')).toBe('15');
  });

  it('re-computes weight when infill changes', () => {
    renderCard();
    const before = getTotalGrams();

    const infillInput = getInfillInput();
    act(() => setInputValue(infillInput, '80'));

    const after = getTotalGrams();
    expect(after).toBeGreaterThan(before);
  });

  it('does not call onApply on mount', () => {
    const { onApply } = renderCard();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('Apply calls onApply with the estimated grams on the first filament row (existing onImport contract)', () => {
    const { onApply } = renderCard();
    const grams = getTotalGrams();

    const applyBtn = [...document.body.querySelectorAll('button')].find(
      b => /apply to calculator/i.test(b.textContent || '')
    )!;
    act(() => applyBtn.click());

    expect(onApply).toHaveBeenCalledTimes(1);
    const arg = onApply.mock.calls[0][0];
    expect(arg.filaments).toHaveLength(1);
    expect(arg.filaments[0].filamentId).toBe('fil-1');
    expect(arg.filaments[0].grams).toBeCloseTo(grams, 1);
    expect(arg.printTimeHours).toBe(0);
  });

  it('shows a non-manifold warning when the estimate is flagged', () => {
    renderCard(vi.fn(), vi.fn(), { ...ESTIMATE, isNonManifold: true });
    expect(document.body.textContent).toMatch(/mesh has errors/i);
  });

  it('shows a units warning with a Treat-as-inches action for an implausible bounding box', () => {
    const tinyEstimate: MeshEstimateWorkerOutput = {
      ...ESTIMATE,
      boundingBoxMm: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0.2, y: 0.2, z: 0.2 },
        size: { x: 0.2, y: 0.2, z: 0.2 },
      },
    };
    renderCard(vi.fn(), vi.fn(), tinyEstimate);
    expect(document.body.textContent).toMatch(/inches/i);
    const treatAsInchesBtn = [...document.body.querySelectorAll('button')].find(
      b => /treat as inches/i.test(b.textContent || '')
    );
    expect(treatAsInchesBtn).toBeTruthy();
  });

  it('falls back to PLA density and says so when no filament is selected (D-10)', () => {
    renderCard(vi.fn(), vi.fn(), ESTIMATE, null);
    expect(document.body.textContent).toMatch(/PLA/i);
  });
});

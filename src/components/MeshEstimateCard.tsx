import { useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, Currency } from '../types';
import { computeMeshEstimate, type MeshGeometryResult } from '../utils/stlParser';
import { estimateWeightGrams } from '../utils/meshWeightModel';
import { detectUnitsWarning, convertInchesToMm } from '../utils/unitsHeuristic';
import { getMaterialDensity } from '../utils/gcodeParser';
import type { MeshEstimateWorkerOutput } from '../workers/meshEstimate.worker';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Button, Card, Input } from './ui';
import { NewBadge } from './NewBadge';

// D-14: infill defaults to 15% (PrusaSlicer/Bambu Studio "Standard" default)
// and remembers the last value used — same localStorage pattern as the Quote
// Variants discount default (NOT a UserProfile/Dexie field).
const DEFAULT_INFILL_PERCENT = 15;

/** Square preview viewport size in CSS px — a compact rotatable preview (D-11), not a full 3D editor. */
const PREVIEW_SIZE_PX = 220;

/**
 * Structural subset of THREE.WebGLRenderer/OrbitControls this preview
 * touches. Deliberately hand-declared (not `import type {...} from 'three'`)
 * so no `from 'three'` line exists anywhere in this file — three is loaded
 * strictly via dynamic import() (assert-no-static-three-import.mjs).
 */
interface MinimalRenderer {
  domElement: HTMLCanvasElement;
  dispose: () => void;
  setSize: (w: number, h: number) => void;
  render: (scene: unknown, camera: unknown) => void;
}
interface MinimalControls {
  target: { copy: (v: unknown) => void };
  update: () => void;
  dispose: () => void;
}

export interface MeshEstimateApplyResult {
  filaments: Array<{ filamentId?: string; grams: number }>;
  printTimeHours: number;
  printName?: string;
}

interface MeshEstimateCardProps {
  fileName: string;
  estimate: MeshEstimateWorkerOutput;
  /** First selected filament row's asset (D-10) — null when no row is selected yet (PLA fallback). */
  selectedFilament: Asset | null;
  userCurrency: Currency;
  currencySymbol: string;
  /** Matches GcodeImport's existing onImport contract (D-12) — no new pre-fill path. */
  onApply: (result: MeshEstimateApplyResult) => void;
  onDismiss: () => void;
}

/**
 * Review card for the STL/3MF instant-quote estimate (CONN-02). Nothing here
 * touches the calculator form until the maker clicks "Apply to calculator"
 * (D-12) — the four accuracy guards (shells+infill weight, infill input,
 * units warning, non-manifold warning) plus the estimate disclaimer all live
 * here, above an explicit Apply action.
 */
export function MeshEstimateCard({
  fileName,
  estimate,
  selectedFilament,
  userCurrency: _userCurrency,
  currencySymbol,
  onApply,
  onDismiss,
}: MeshEstimateCardProps) {
  const [infillPercent, setInfillPercent] = useLocalStorage<number>('stl-estimate-infill', DEFAULT_INFILL_PERCENT);
  // D-15: a manual mm/inch toggle stays available regardless of the auto-warning.
  const [isInches, setIsInches] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const effectivePosition = useMemo(
    () => (isInches ? convertInchesToMm(estimate.position) : estimate.position),
    [estimate.position, isInches]
  );

  const effectiveGeometry: MeshGeometryResult = useMemo(
    () =>
      isInches
        ? computeMeshEstimate(effectivePosition)
        : {
            volumeCm3: estimate.volumeCm3,
            surfaceAreaCm2: estimate.surfaceAreaCm2,
            boundingBoxMm: estimate.boundingBoxMm,
            isNonManifold: estimate.isNonManifold,
          },
    [effectivePosition, isInches, estimate]
  );

  // D-15: warn off the ORIGINAL parsed size, not the (possibly already
  // converted) effective size — once the maker acts, the auto-warning clears.
  const showUnitsWarning = !isInches && detectUnitsWarning(estimate.boundingBoxMm.size);

  const usedPlaFallback = !selectedFilament?.filamentType;
  const densityGCm3 = selectedFilament?.filamentType
    ? getMaterialDensity(selectedFilament.filamentType)
    : undefined;

  const weight = useMemo(
    () =>
      estimateWeightGrams({
        volumeCm3: effectiveGeometry.volumeCm3,
        surfaceAreaCm2: effectiveGeometry.surfaceAreaCm2,
        infillPercent,
        densityGCm3,
      }),
    [effectiveGeometry, infillPercent, densityGCm3]
  );

  const materialCost =
    selectedFilament?.costPerUnit != null ? weight.totalGrams * selectedFilament.costPerUnit : null;

  const { size } = effectiveGeometry.boundingBoxMm;

  // 3D preview (D-11) — three.js loaded ONLY via dynamic import(), so it stays
  // in the lazy three chunk (assert-no-static-three-import.mjs). The WebGL
  // render/rotate itself is verified by the Task 4 human-verify checkpoint;
  // a failed/unavailable WebGL context degrades silently (the estimate
  // numbers below remain fully usable without the preview).
  useEffect(() => {
    let disposed = false;
    let renderer: MinimalRenderer | null = null;
    let controls: MinimalControls | null = null;
    let frameId: number | null = null;

    async function setup() {
      if (!canvasRef.current) return;
      const THREE = await import('three');
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(effectivePosition, 3));
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ color: 0x60a5fa });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(1, 1, 1);
      scene.add(dirLight);

      const box = new THREE.Box3().setFromObject(mesh);
      const boxSize = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z) || 1;
      camera.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim);
      camera.lookAt(center);

      const rendererInstance = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true,
      }) as unknown as MinimalRenderer;
      rendererInstance.setSize(PREVIEW_SIZE_PX, PREVIEW_SIZE_PX);
      renderer = rendererInstance;

      const orbitControls = new OrbitControls(camera, rendererInstance.domElement) as unknown as MinimalControls;
      orbitControls.target.copy(center);
      orbitControls.update();
      controls = orbitControls;

      const animate = () => {
        if (disposed) return;
        controls?.update();
        renderer?.render(scene, camera);
        frameId = requestAnimationFrame(animate);
      };
      animate();
    }

    setup().catch(() => {
      // WebGL unavailable/failed — preview silently degrades; estimate
      // numbers and Apply remain fully functional.
    });

    return () => {
      disposed = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
      controls?.dispose();
      renderer?.dispose();
    };
  }, [effectivePosition]);

  const handleApply = () => {
    onApply({
      filaments: [{ filamentId: selectedFilament?.id, grams: weight.totalGrams }],
      printTimeHours: 0,
    });
  };

  return (
    <Card padding="md" className="mb-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Mesh estimate — {fileName}</h3>
          <NewBadge feature="stl-estimate" />
        </div>
        <Button variant="ghost" btnSize="sm" onClick={onDismiss}>
          Discard estimate
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="shrink-0 rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
          {/* allow-raw-html: bare WebGL surface — the three.js renderer owns this canvas directly */}
          <canvas ref={canvasRef} width={PREVIEW_SIZE_PX} height={PREVIEW_SIZE_PX} />
        </div>

        <div className="flex-1 space-y-3 text-sm">
          <div>
            <p className="text-slate-400 text-xs mb-1">Model dimensions</p>
            <p className="text-white">
              {size.x.toFixed(1)} × {size.y.toFixed(1)} × {size.z.toFixed(1)} mm
              {estimate.objectCount > 1 && (
                <span className="text-slate-400"> — {estimate.objectCount} objects</span>
              )}
            </p>
          </div>

          {showUnitsWarning && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-amber-300 text-xs flex items-center justify-between gap-2 flex-wrap">
              <span>This looks like it might be in inches, not mm.</span>
              <Button variant="secondary" btnSize="sm" onClick={() => setIsInches(true)}>
                Treat as inches
              </Button>
            </div>
          )}

          <Button variant="ghost" btnSize="sm" onClick={() => setIsInches(v => !v)}>
            Units: {isInches ? 'inches (converted ×25.4)' : 'mm'} — switch to {isInches ? 'mm' : 'inches'}
          </Button>

          {effectiveGeometry.isNonManifold && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-red-300 text-xs">
              Mesh has errors — volume may be inaccurate.
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1" htmlFor="mesh-estimate-infill">
              Infill %
            </label>
            <Input
              id="mesh-estimate-infill"
              type="number"
              min="0"
              max="100"
              compact
              value={infillPercent}
              onChange={e => setInfillPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
            />
          </div>

          <div className="bg-slate-700/30 rounded-lg p-3 space-y-1">
            <p className="text-slate-400 text-xs">
              Estimated weight (shells + {infillPercent}% infill)
              {usedPlaFallback && ' — assuming PLA density (no filament selected)'}
            </p>
            <p className="text-white font-medium" data-testid="mesh-estimate-total-grams" data-grams={weight.totalGrams}>
              {weight.totalGrams.toFixed(1)}g
              <span className="text-slate-400 font-normal text-xs ml-2">
                ({weight.shellGrams.toFixed(1)}g shells + {weight.infillGrams.toFixed(1)}g infill)
              </span>
            </p>
            {materialCost != null ? (
              <p className="text-slate-300 text-xs">
                Material cost: {currencySymbol}{materialCost.toFixed(2)}
              </p>
            ) : (
              <p className="text-slate-400 text-xs">Select a filament to see material cost.</p>
            )}
          </div>

          <p className="text-slate-500 text-xs italic">
            This is an estimate — review before quoting.
          </p>

          <Button variant="primary" btnSize="sm" onClick={handleApply}>
            Apply to calculator
          </Button>
        </div>
      </div>
    </Card>
  );
}

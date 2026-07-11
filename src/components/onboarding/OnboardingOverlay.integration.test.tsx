import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, createElement } from 'react';
import { OnboardingOverlay } from './OnboardingOverlay';
import { ToastProvider } from '../ui';
import { db } from '../../db/database';
import { defaultPrinterAssets } from '../../data/defaultMaterials';

// ---------------------------------------------------------------------------
// Phase 42 gap-closure regression test — see
// .planning/debug/onboarding-tile-autoskip-race.md for the full diagnosis.
//
// OnboardingOverlay.test.tsx statically mocks BOTH useOnboarding and
// usePrinterInstances, so `instances.length` never changes within a test —
// the same-render race between a live-updating `instances.length`
// (usePrinterInstances is real Dexie useLiveQuery) and a not-yet-updated
// `step` (useUserProfile is a one-shot load, not liveQuery-reactive) that
// causes the step-0 printer tile to unmount the wizard instead of advancing
// it is invisible to those mocks. This test is intentionally NON-mocked: it
// drives the REAL OnboardingOverlay against a REAL (fake-indexeddb) Dexie so
// that timing race is actually exercised. Only `navigateToTab` is a stub.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  await db.printerInstances.clear();
  await db.settings.clear();
  await db.materials.clear();
  await db.jobs.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function waitForAsync() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function renderOverlay(
  navigateToTab: (tab: 'settings' | 'materials' | 'calculator') => void = vi.fn()
) {
  act(() => {
    root.render(
      createElement(ToastProvider, null, createElement(OnboardingOverlay, { navigateToTab }))
    );
  });
}

function findPrinterTile(): HTMLButtonElement {
  const firstPrinterName = defaultPrinterAssets[0].name;
  const tile = Array.from(container.querySelectorAll('button')).find(
    btn => btn.textContent === firstPrinterName
  );
  expect(tile).not.toBeUndefined();
  return tile as HTMLButtonElement;
}

describe('OnboardingOverlay — real-Dexie tile-autoskip race regression (Phase 42 gap closure)', () => {
  it('tile click advances to the filament step AND persists onboardingStep', async () => {
    renderOverlay();
    await waitForAsync();
    await waitForAsync();

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('Add your printer');
    expect(dialog!.textContent).toContain('Step 1 of 3');

    const tile = findPrinterTile();
    act(() => {
      tile.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Flush: the printer write, the liveQuery re-emit, the advanceStep
    // profile write, and the resulting re-render all need to settle.
    await waitForAsync();
    await waitForAsync();
    await waitForAsync();

    expect(await db.printerInstances.count()).toBe(1);

    // THIS is the assertion that fails on pre-fix code — the step is never
    // persisted because advanceStep(1) is never called (see debug session).
    const row = await db.settings.get('userProfile');
    expect(row).toBeDefined();
    expect(JSON.parse(row!.value).onboardingStep).toBe(1);

    // The overlay must have ADVANCED, not unmounted.
    expect(container.textContent).not.toBe('');
    expect(container.textContent).toContain('Add your filament');
    expect(container.textContent).toContain('Step 2 of 3');
  });

  it('reload resumes at the filament step', async () => {
    renderOverlay();
    await waitForAsync();
    await waitForAsync();

    const tile = findPrinterTile();
    act(() => {
      tile.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAsync();
    await waitForAsync();
    await waitForAsync();

    // Simulate a reload: unmount and mount a FRESH root/component so every
    // hook re-reads from Dexie from scratch. Tables are NOT cleared — a
    // reload preserves existing data (this is not a new session).
    act(() => root.unmount());
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    renderOverlay();
    await waitForAsync();
    await waitForAsync();

    expect(container.textContent).not.toBe('');
    expect(container.textContent).toContain('Add your filament');
    expect(container.textContent).toContain('Step 2 of 3');
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { createElement } from 'react';
import { OnboardingOverlay } from './OnboardingOverlay';

// ---------------------------------------------------------------------------
// OnboardingOverlay — Phase 42 Plan 02 Task 2.
//
// Test strategy: raw createRoot + act harness (project precedent — see
// App.test.tsx / useFailureEvents.test.tsx). No @testing-library/react in
// this codebase. useOnboarding + the Dexie-backed hooks it and the overlay
// consume are all mocked so mounting never touches a real IndexedDB.
// ---------------------------------------------------------------------------

const mockUseOnboarding = vi.fn();
const mockSkip = vi.fn();
const mockAdvanceStep = vi.fn();
const mockComplete = vi.fn();
const mockAddInstance = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('../../hooks/onboarding/useOnboarding', () => ({
  useOnboarding: () => mockUseOnboarding(),
}));

vi.mock('../../hooks/useDatabase', () => ({
  usePrinterInstances: () => ({ instances: [], addInstance: mockAddInstance }),
  useMaterials: () => ({ materials: [], isLoading: false }),
  useJobs: () => ({ jobs: [], isLoading: false }),
}));

vi.mock('../ui/toast/useToast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: vi.fn(), info: vi.fn() }),
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function baseOnboarding(overrides: Partial<ReturnType<typeof mockUseOnboarding>> = {}) {
  return {
    step: 0,
    isDone: false,
    shouldShow: true,
    advanceStep: mockAdvanceStep,
    complete: mockComplete,
    skip: mockSkip,
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  mockUseOnboarding.mockReset();
  mockSkip.mockReset();
  mockAdvanceStep.mockReset();
  mockComplete.mockReset();
  mockAddInstance.mockReset();
  mockToastSuccess.mockReset();
});

function render(navigateToTab: (tab: 'settings' | 'materials' | 'calculator') => void = vi.fn()) {
  act(() => {
    root!.render(createElement(OnboardingOverlay, { navigateToTab }));
  });
}

describe('OnboardingOverlay — visibility', () => {
  it('returns null (renders nothing) when shouldShow is false', () => {
    mockUseOnboarding.mockReturnValue(baseOnboarding({ shouldShow: false }));
    render();
    expect(container!.querySelector('[role="dialog"]')).toBeNull();
    expect(container!.textContent).toBe('');
  });

  it('renders the printer step at step 0', () => {
    mockUseOnboarding.mockReturnValue(baseOnboarding({ step: 0 }));
    render();
    const dialog = container!.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(container!.textContent).toContain('Add your printer');
    expect(container!.textContent).toContain('Step 1 of 3');
  });
});

describe('OnboardingOverlay — skip affordance', () => {
  it('shows the skip control on the rendered step', () => {
    mockUseOnboarding.mockReturnValue(baseOnboarding({ step: 0 }));
    render();
    const skipButton = Array.from(container!.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Skip'));
    expect(skipButton).not.toBeUndefined();
  });

  it('clicking skip triggers completion', () => {
    mockUseOnboarding.mockReturnValue(baseOnboarding({ step: 0 }));
    render();
    const skipButton = Array.from(container!.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Skip'));
    expect(skipButton).not.toBeUndefined();

    act(() => {
      skipButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockSkip).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingOverlay — printer tile deterministic advance (Phase 42 gap closure)', () => {
  it('clicking the first printer quick-add tile calls addInstance and advanceStep(1)', async () => {
    mockUseOnboarding.mockReturnValue(baseOnboarding({ step: 0 }));
    render();

    const tileButton = Array.from(container!.querySelectorAll('button'))
      .find(btn => btn.textContent === 'Bambu Lab A1 mini');
    expect(tileButton).not.toBeUndefined();

    await act(async () => {
      tileButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockAddInstance).toHaveBeenCalledTimes(1);
    expect(mockAdvanceStep).toHaveBeenCalledWith(1);
  });
});

describe('OnboardingOverlay — step content', () => {
  it('renders the filament step at step 1', () => {
    mockUseOnboarding.mockReturnValue(baseOnboarding({ step: 1 }));
    render();
    expect(container!.textContent).toContain('Add your filament');
    expect(container!.textContent).toContain('Step 2 of 3');
  });

  it('renders the price-a-job step at step 2', () => {
    mockUseOnboarding.mockReturnValue(baseOnboarding({ step: 2 }));
    render();
    expect(container!.textContent).toContain('Price your first job');
    expect(container!.textContent).toContain('Step 3 of 3');
  });

  it('navigates to the settings tab when "Mine isn\'t listed" is used on the printer step', () => {
    mockUseOnboarding.mockReturnValue(baseOnboarding({ step: 0 }));
    const navigateToTab = vi.fn();
    render(navigateToTab);

    const secondaryButton = Array.from(container!.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes("Mine isn't listed"));
    expect(secondaryButton).not.toBeUndefined();

    act(() => {
      secondaryButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(navigateToTab).toHaveBeenCalledWith('settings');
  });
});

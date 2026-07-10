import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { createElement } from 'react';
import { useOnboarding, type UseOnboardingResult } from './useOnboarding';
import type { UserProfile, PrinterInstance } from '../../types';

// ---------------------------------------------------------------------------
// useOnboarding — Phase 42 Plan 02 Task 1.
//
// Test strategy: raw createRoot + act harness (project precedent — see
// useFailureEvents.test.tsx). No renderHook library in this codebase.
// useUserProfile / usePrinterInstances are mocked so the pure derivation
// logic (shouldShow/isDone/step/advanceStep/complete/skip) is testable
// without a live Dexie.
// ---------------------------------------------------------------------------

const mockUseUserProfile = vi.fn();
const mockUsePrinterInstances = vi.fn();

vi.mock('../useDatabase', () => ({
  useUserProfile: () => mockUseUserProfile(),
  usePrinterInstances: () => mockUsePrinterInstances(),
}));

const BASE_PROFILE: UserProfile = {
  currency: 'CAD',
  laborHourlyRate: 15,
};

function profileMock(overrides: Partial<UserProfile> = {}, updateProfile = vi.fn(), isLoading = false) {
  mockUseUserProfile.mockReturnValue({
    profile: { ...BASE_PROFILE, ...overrides },
    updateProfile,
    isLoading,
  });
  return updateProfile;
}

function instancesMock(instances: PrinterInstance[] = [], isLoading = false) {
  mockUsePrinterInstances.mockReturnValue({ instances, isLoading });
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestApi: UseOnboardingResult | null = null;

function Harness({ onReady }: { onReady: (api: UseOnboardingResult) => void }) {
  const api = useOnboarding();
  onReady(api);
  return createElement('div', { 'data-testid': 'step' }, api.step);
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
  latestApi = null;
  mockUseUserProfile.mockReset();
  mockUsePrinterInstances.mockReset();
});

function render() {
  act(() => {
    root!.render(createElement(Harness, { onReady: (api) => { latestApi = api; } }));
  });
}

function api(): UseOnboardingResult {
  if (!latestApi) throw new Error('hook API not ready — call render() first');
  return latestApi;
}

describe('useOnboarding — isDone', () => {
  it('isDone is true when onboardingCompletedAt is a truthy ISO string', () => {
    profileMock({ onboardingCompletedAt: '2026-07-10T00:00:00.000Z' });
    instancesMock([]);
    render();
    expect(api().isDone).toBe(true);
  });

  it('isDone is false when onboardingCompletedAt is unset', () => {
    profileMock({});
    instancesMock([]);
    render();
    expect(api().isDone).toBe(false);
  });
});

describe('useOnboarding — shouldShow (auto-skip / first-run detection)', () => {
  it('shouldShow is false when the user owns at least one printer instance, even if onboardingCompletedAt is unset', () => {
    profileMock({});
    instancesMock([{ id: 'inst-1', printerConfigId: 'p1', nickname: 'My A1', printHours: 0 }]);
    render();
    expect(api().shouldShow).toBe(false);
  });

  it('shouldShow is false when onboardingCompletedAt is set, regardless of printer instances', () => {
    profileMock({ onboardingCompletedAt: '2026-07-10T00:00:00.000Z' });
    instancesMock([]);
    render();
    expect(api().shouldShow).toBe(false);
  });

  it('shouldShow is true only when onboardingCompletedAt is unset AND printerInstances is empty AND profile has loaded', () => {
    profileMock({}, vi.fn(), false);
    instancesMock([], false);
    render();
    expect(api().shouldShow).toBe(true);
  });

  it('shouldShow is false while profile or instances are still loading', () => {
    profileMock({}, vi.fn(), true);
    instancesMock([], false);
    render();
    expect(api().shouldShow).toBe(false);
  });

  it('shouldShow stays true after step > 0 even once a printer instance now exists (resume mid-wizard, not re-triggered auto-skip)', () => {
    // The user progressed past the printer step (onboardingStep=1) by adding
    // a printer instance via the wizard's own step-0 tile. A reload (or a
    // re-render right after the tile write) must not hide the overlay just
    // because instances.length is now >0 — otherwise "resumes after reload"
    // (must_haves truth) is broken by the wizard's own step-0 action.
    profileMock({ onboardingStep: 1 });
    instancesMock([{ id: 'inst-1', printerConfigId: 'p1', nickname: 'My A1', printHours: 0 }]);
    render();
    expect(api().shouldShow).toBe(true);
  });
});

describe('useOnboarding — step resolution', () => {
  it('step resolves to profile.onboardingStep ?? 0', () => {
    profileMock({ onboardingStep: 2 });
    instancesMock([]);
    render();
    expect(api().step).toBe(2);
  });

  it('step defaults to 0 when onboardingStep is unset', () => {
    profileMock({});
    instancesMock([]);
    render();
    expect(api().step).toBe(0);
  });
});

describe('useOnboarding — advanceStep / complete / skip persistence', () => {
  it('advanceStep(n) persists onboardingStep=n via updateProfile', async () => {
    const updateProfile = profileMock({ onboardingStep: 0 });
    instancesMock([]);
    render();

    await act(async () => {
      await api().advanceStep(1);
    });

    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ onboardingStep: 1 }));
  });

  it('complete() persists an ISO onboardingCompletedAt', async () => {
    const updateProfile = profileMock({});
    instancesMock([]);
    render();

    await act(async () => {
      await api().complete();
    });

    expect(updateProfile).toHaveBeenCalledTimes(1);
    const arg = updateProfile.mock.calls[0][0] as UserProfile;
    expect(typeof arg.onboardingCompletedAt).toBe('string');
    expect(() => new Date(arg.onboardingCompletedAt as string).toISOString()).not.toThrow();
  });

  it('skip() calls complete() (skip == permanent completion, never re-shown)', async () => {
    const updateProfile = profileMock({});
    instancesMock([]);
    render();

    await act(async () => {
      await api().skip();
    });

    expect(updateProfile).toHaveBeenCalledTimes(1);
    const arg = updateProfile.mock.calls[0][0] as UserProfile;
    expect(typeof arg.onboardingCompletedAt).toBe('string');
  });
});

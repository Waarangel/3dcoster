import { useCallback } from 'react';
import { useUserProfile, usePrinterInstances } from '../useDatabase';

// Phase 42 ONBD-01. Pure derivation over the existing useUserProfile +
// usePrinterInstances hooks — no new Dexie tables, no localStorage.
//
// Auto-skip (T-42-06/D-09): shouldShow is keyed on OWNED printer instances
// (usePrinterInstances, empty on a brand-new DB), never on the seeded
// printer/material catalog in db.materials (which is pre-populated on
// first run — see useAssets init in useDatabase.ts). Completion/skip
// persist onboardingCompletedAt via updateProfile so a returning user is
// never re-shown or re-seeded.

export interface UseOnboardingResult {
  /** Current step index: 0=printer, 1=filament, 2=price-a-job. */
  step: number;
  /** true when onboardingCompletedAt is set (finished OR skipped — same thing). */
  isDone: boolean;
  /** true only when profile+instances have loaded, the wizard isn't done, and the user owns no printer instance. */
  shouldShow: boolean;
  /** Persist the next step index. */
  advanceStep: (next: number) => Promise<void>;
  /** Persist an ISO onboardingCompletedAt — wizard is finished, never shown again. */
  complete: () => Promise<void>;
  /** Skip == permanent completion. Never re-shown. */
  skip: () => Promise<void>;
}

export function useOnboarding(): UseOnboardingResult {
  const { profile, updateProfile, isLoading: profileLoading } = useUserProfile();
  const { instances, isLoading: instancesLoading } = usePrinterInstances();

  const isDone = Boolean(profile.onboardingCompletedAt);
  const step = profile.onboardingStep ?? 0;
  const shouldShow = !profileLoading && !instancesLoading && !isDone && instances.length === 0;

  const advanceStep = useCallback(async (next: number) => {
    await updateProfile({ ...profile, onboardingStep: next });
  }, [profile, updateProfile]);

  const complete = useCallback(async () => {
    await updateProfile({ ...profile, onboardingCompletedAt: new Date().toISOString() });
  }, [profile, updateProfile]);

  const skip = useCallback(async () => {
    await complete();
  }, [complete]);

  return { step, isDone, shouldShow, advanceStep, complete, skip };
}

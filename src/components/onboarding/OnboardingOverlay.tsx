import { useEffect, useRef } from 'react';
import { useOnboarding } from '../../hooks/onboarding/useOnboarding';
import { usePrinterInstances, useMaterials, useJobs } from '../../hooks/useDatabase';
import { defaultPrinterAssets, defaultMaterials } from '../../data/defaultMaterials';
import { useToast } from '../ui/toast/useToast';
import { OnboardingStep } from './OnboardingStep';
import type { PrinterInstance } from '../../types';

// Phase 42 ONBD-01 (D-09..D-12). Container: consumes useOnboarding + the
// real Dexie hooks and renders the current step via the presentational
// OnboardingStep. No duplicate mini-forms — quick-add tiles write through
// the SAME add paths PrinterSettings/AssetLibrary use, and "mine isn't
// listed" navigates to the real tab via the App-owned Phase 38 ?tab=
// routing (navigateToTab prop — no routing import here).

const TOTAL_STEPS = 3;
const QUICK_ADD_COUNT = 3;

function makeInstanceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `instance-${crypto.randomUUID()}`
    : `instance-${Date.now()}`;
}

type NavigableTab = 'settings' | 'materials' | 'calculator';

interface OnboardingOverlayProps {
  navigateToTab: (tab: NavigableTab, options?: { replace?: boolean }) => void;
}

export function OnboardingOverlay({ navigateToTab }: OnboardingOverlayProps) {
  const { step, shouldShow, advanceStep, complete, skip } = useOnboarding();
  const { instances, addInstance } = usePrinterInstances();
  const { materials, isLoading: materialsLoading } = useMaterials();
  const { jobs, isLoading: jobsLoading } = useJobs();
  const toast = useToast();

  // Baselines captured once per step entry (T-42-07 / critical_constraints):
  // the printer/filament catalogs are pre-seeded on a brand-new DB, so a
  // raw "count === 0" check never fires for materials. Capturing a
  // baseline on step entry and advancing when the live count increases
  // past it also catches a manual add via "mine isn't listed" (the real
  // PrinterSettings/AssetLibrary form), not just a quick-add tile.
  const filamentBaselineRef = useRef<number | null>(null);
  const jobBaselineRef = useRef<number | null>(null);

  useEffect(() => {
    if (step !== 1) filamentBaselineRef.current = null;
  }, [step]);

  useEffect(() => {
    if (step !== 2) jobBaselineRef.current = null;
  }, [step]);

  // Step 0 → 1: shouldShow's own gate guarantees instances is empty while
  // step is 0 (auto-skip, T-42-06), so ANY instance appearing means the
  // printer step is done — via a quick-add tile or a manual add on the
  // Printers tab.
  useEffect(() => {
    if (!shouldShow || step !== 0) return;
    if (instances.length > 0) {
      advanceStep(1);
    }
  }, [shouldShow, step, instances.length, advanceStep]);

  // Step 1 → 2: advance when a NEW filament is added (count increases past
  // the entry baseline) — never on raw count===0 since the catalog is
  // pre-seeded.
  useEffect(() => {
    if (!shouldShow || step !== 1 || materialsLoading) return;
    if (filamentBaselineRef.current === null) {
      filamentBaselineRef.current = materials.length;
      return;
    }
    if (materials.length > filamentBaselineRef.current) {
      advanceStep(2);
    }
  }, [shouldShow, step, materials.length, materialsLoading, advanceStep]);

  // Step 2 → done: advance when the first job is saved (the persisted
  // "first cost calculation"), mirroring the filament baseline pattern.
  useEffect(() => {
    if (!shouldShow || step !== 2 || jobsLoading) return;
    if (jobBaselineRef.current === null) {
      jobBaselineRef.current = jobs.length;
      return;
    }
    if (jobs.length > jobBaselineRef.current) {
      complete();
      toast.success("You're ready — save this job or create a quote");
    }
  }, [shouldShow, step, jobs.length, jobsLoading, complete, toast]);

  if (!shouldShow) return null;

  if (step === 0) {
    const tiles = defaultPrinterAssets.slice(0, QUICK_ADD_COUNT).map(printer => ({
      label: printer.name,
      // Deterministic advance path (Phase 42 gap closure, T-42-09): await the
      // printer write, then persist the step directly — mirroring the
      // non-racy step-1 filament tile below. This no longer depends on the
      // instances.length-driven auto-advance effect above, which loses the
      // race against shouldShow recomputing on the SAME render (see
      // .planning/debug/onboarding-tile-autoskip-race.md). The effect stays
      // in place as a best-effort catch for a manual "Mine isn't listed" add;
      // advanceStep(1) is idempotent so there is no double-advance.
      onClick: async () => {
        const instance: PrinterInstance = {
          id: makeInstanceId(),
          printerConfigId: printer.id,
          nickname: printer.name,
          printHours: 0,
        };
        await addInstance(instance);
        await advanceStep(1);
      },
    }));

    return (
      <OnboardingStep
        stepNumber={1}
        totalSteps={TOTAL_STEPS}
        title="Add your printer"
        body="Pick your printer below, or add it yourself in Printers."
        tiles={tiles}
        secondaryActionLabel="Mine isn't listed"
        onSecondaryAction={() => navigateToTab('settings')}
        onSkip={skip}
      />
    );
  }

  if (step === 1) {
    const tiles = defaultMaterials.slice(0, QUICK_ADD_COUNT).map(material => ({
      label: material.name,
      onClick: () => advanceStep(2),
    }));

    return (
      <OnboardingStep
        stepNumber={2}
        totalSteps={TOTAL_STEPS}
        title="Add your filament"
        body="Confirm a filament you use below, or add your own in Assets."
        tiles={tiles}
        secondaryActionLabel="Mine isn't listed"
        onSecondaryAction={() => navigateToTab('materials')}
        onSkip={skip}
        nextLabel="I already have filament set up"
        onNext={() => advanceStep(2)}
      />
    );
  }

  return (
    <OnboardingStep
      stepNumber={3}
      totalSteps={TOTAL_STEPS}
      title="Price your first job"
      body="Head to the Calculator, enter a print, and save it — we'll take it from there."
      secondaryActionLabel="Go to Calculator"
      onSecondaryAction={() => navigateToTab('calculator')}
      onSkip={skip}
    />
  );
}

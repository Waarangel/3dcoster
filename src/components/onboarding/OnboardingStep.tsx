import { Button } from '../ui';

// Phase 42 ONBD-01 (D-09..D-11). Presentational floating step card — no
// hooks, no Dexie access. OnboardingOverlay owns all state/behavior and
// passes everything in as props. Every step renders the skip control
// (D-10 anti-feature: never mandatory) and a step indicator.

export interface OnboardingTile {
  label: string;
  onClick: () => void;
}

interface OnboardingStepProps {
  /** 1-based step number for the "Step X of Y" indicator. */
  stepNumber: number;
  totalSteps: number;
  title: string;
  body: string;
  tiles?: OnboardingTile[];
  /** e.g. "Mine isn't listed" — secondary path into the real add form. */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  onSkip: () => void;
  /** Manual advance — for a user who already has what this step asks for
   * (e.g. already owns filament from the pre-seeded catalog) and doesn't
   * need a tile or the real-write auto-advance to fire. Optional; when
   * omitted, only the real-write auto-advance moves the wizard forward. */
  nextLabel?: string;
  onNext?: () => void;
}

export function OnboardingStep({
  stepNumber,
  totalSteps,
  title,
  body,
  tiles,
  secondaryActionLabel,
  onSecondaryAction,
  onSkip,
  nextLabel,
  onNext,
}: OnboardingStepProps) {
  return (
    <div
      role="dialog"
      aria-label="Guided setup"
      className="fixed bottom-4 right-4 z-40 w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-blue-400">
          Step {stepNumber} of {totalSteps}
        </span>
        <Button
          variant="ghost"
          btnSize="sm"
          onClick={onSkip}
          className="text-xs text-slate-400 hover:text-slate-200 min-h-0 px-2 py-1"
        >
          Skip — I know what I&apos;m doing
        </Button>
      </div>

      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-300 mt-1">{body}</p>
      </div>

      {tiles && tiles.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {tiles.map(tile => (
            <Button
              key={tile.label}
              variant="secondary"
              btnSize="sm"
              onClick={tile.onClick}
              className="justify-start text-left"
            >
              {tile.label}
            </Button>
          ))}
        </div>
      )}

      {secondaryActionLabel && onSecondaryAction && (
        <Button
          variant="ghost"
          btnSize="sm"
          onClick={onSecondaryAction}
          className="text-sm text-blue-400 hover:text-blue-300 min-h-0 px-0 py-0 justify-start"
        >
          {secondaryActionLabel}
        </Button>
      )}

      {onNext && (
        <Button variant="primary" btnSize="sm" onClick={onNext} fullWidth>
          {nextLabel ?? 'Next'}
        </Button>
      )}

      <p className="text-xs text-slate-500">You can change all of this in Settings.</p>
    </div>
  );
}

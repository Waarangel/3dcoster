# Phase 5: Printer Maintenance Alerts - Research

**Researched:** 2026-04-15
**Domain:** React state management, localStorage persistence, dismissable alert UI (no external libraries needed)
**Confidence:** HIGH

## Summary

Phase 5 is a self-contained feature with no new dependencies. The project already has all required infrastructure: `PrinterInstance.printHours` accumulates hours on every job save via `addPrintHours()` in `useDatabase.ts`, and `App.tsx` calls it at line 108 inside `handleSaveJob`. The only missing pieces are: (1) logic to detect when hours cross a 500-hour interval boundary, (2) localStorage persistence of which intervals have been acknowledged per printer instance, and (3) a dismissable modal component to surface the alert.

The alert must fire *after* the job save that pushes hours over a boundary — i.e., the alert is detected and shown in `handleSaveJob` in App.tsx, after `addPrintHours` resolves. The dismissed-intervals store must be keyed per printer instance so dismissing one printer's alert does not suppress another's. No backend, no new DB tables, no new Dexie versions are required — localStorage is the right persistence layer for "dismissed intervals" (same pattern already used by `NewBadge` and `useLocalStorage`).

**Primary recommendation:** Detect boundary crossing in `handleSaveJob`, persist dismissed intervals to localStorage, render a single `MaintenanceAlertModal` component in App.tsx using the existing modal pattern from `UserProfileModal`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAINT-01 | Popup warning when printer crosses 500h maintenance interval (500, 1000, 1500, etc.) | Hours already tracked; boundary detection is arithmetic; modal pattern exists |
| MAINT-02 | Maintenance alert is dismissable and does not re-trigger for acknowledged intervals | localStorage key per instance stores Set of acknowledged multiples; same pattern as NewBadge |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (already installed) | 18 | Modal state, useEffect for detection | Already in project |
| localStorage (built-in) | — | Persist dismissed intervals per printer | Same pattern as NewBadge, useLocalStorage hook |
| Dexie / IndexedDB (already installed) | current | `printHours` already stored here; no new tables | No new DB schema needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useLocalStorage` hook (exists at `src/hooks/useLocalStorage.ts`) | — | Read/write dismissed intervals | Use for the dismissed-intervals store |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| localStorage for dismissed intervals | New Dexie table | Dexie is overkill — dismissed intervals are tiny, non-relational, per-device UI state. localStorage is correct. |
| Single modal triggered from App.tsx | Toast notification | Requirement says "popup" — modal is appropriate; toasts auto-dismiss which violates MAINT-02 |

**Installation:**
No new packages needed.

## Architecture Patterns

### Recommended Project Structure

No new files in `src/hooks/` needed. One new component:

```
src/
├── components/
│   └── MaintenanceAlertModal.tsx   # New: dismissable alert popup
├── hooks/
│   └── useLocalStorage.ts          # Existing — used for dismissed intervals
└── App.tsx                          # Modified: detection logic + modal state
```

### Pattern 1: Boundary Detection at Job Save

**What:** After `addPrintHours` resolves, compare old hours vs new hours to find if a 500h multiple was crossed.

**When to use:** Only during job save — not on app load. We detect the crossing event, not a static state.

**Example:**
```typescript
// In App.tsx handleSaveJob
const handleSaveJob = async (job: PrintJob, printHours: number) => {
  // Get instance BEFORE updating hours
  const instance = printerInstances.find(i => i.id === job.printerInstanceId);
  const hoursBefore = instance?.printHours ?? 0;

  await addJob(job);
  await addPrintHours(job.printerInstanceId, printHours);

  // Detect if a 500h interval was crossed
  const hoursAfter = hoursBefore + printHours;
  const INTERVAL = 500;
  const lastIntervalBefore = Math.floor(hoursBefore / INTERVAL);
  const lastIntervalAfter = Math.floor(hoursAfter / INTERVAL);

  if (lastIntervalAfter > lastIntervalBefore && lastIntervalAfter > 0) {
    const crossedInterval = lastIntervalAfter * INTERVAL;
    // Check if not already dismissed
    if (!isDismissed(job.printerInstanceId, crossedInterval)) {
      setMaintenanceAlert({ instanceId: job.printerInstanceId, hours: crossedInterval });
    }
  }
};
```

### Pattern 2: Dismissed Intervals Persistence

**What:** Store acknowledged intervals in localStorage, keyed by printer instance ID.

**When to use:** On dismiss click in `MaintenanceAlertModal`.

**Example:**
```typescript
// localStorage key: '3dcoster-maintenance-dismissed'
// Shape: Record<instanceId, number[]>
// e.g. { "instance-123": [500, 1000] }

const DISMISSED_KEY = '3dcoster-maintenance-dismissed';

function getDismissedMap(): Record<string, number[]> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function isDismissed(instanceId: string, intervalHours: number): boolean {
  const map = getDismissedMap();
  return (map[instanceId] ?? []).includes(intervalHours);
}

function markDismissed(instanceId: string, intervalHours: number): void {
  const map = getDismissedMap();
  const existing = map[instanceId] ?? [];
  if (!existing.includes(intervalHours)) {
    map[instanceId] = [...existing, intervalHours];
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
  }
}
```

### Pattern 3: Modal Component (follows UserProfileModal pattern)

**What:** `MaintenanceAlertModal` uses the exact same modal structure as `UserProfileModal`: fixed overlay, centered card, Escape key close, backdrop click close.

**When to use:** Rendered in App.tsx alongside other modals, shown when `maintenanceAlert` state is non-null.

**Example:**
```typescript
// In App.tsx
const [maintenanceAlert, setMaintenanceAlert] = useState<{
  instanceId: string;
  hours: number;
} | null>(null);

// In JSX (after SettingsModal)
<MaintenanceAlertModal
  alert={maintenanceAlert}
  printerInstances={printerInstances}
  onDismiss={() => {
    if (maintenanceAlert) {
      markDismissed(maintenanceAlert.instanceId, maintenanceAlert.hours);
    }
    setMaintenanceAlert(null);
  }}
/>
```

**MaintenanceAlertModal props:**
```typescript
interface MaintenanceAlertModalProps {
  alert: { instanceId: string; hours: number } | null;
  printerInstances: PrinterInstance[];
  onDismiss: () => void;
}
```

### Anti-Patterns to Avoid

- **Storing dismissed intervals in IndexedDB/Dexie:** Dismissed intervals are ephemeral UI state. They don't need the full async DB pipeline and don't belong alongside business data.
- **Detecting alerts on app load by scanning all instances:** This would fire old alerts that users already handled. Detection must only fire at the moment of job save.
- **Using `printHours` from useLiveQuery for before/after comparison:** `useLiveQuery` state will not have updated yet at the moment of the `await addPrintHours()` call. Use `printerInstances` from the hook (already in App.tsx scope) to get the pre-update value — then add `printHours` to compute the after value.
- **Re-using `window.confirm` for the alert:** The codebase uses `window.confirm` only for destructive deletes. A maintenance alert requires a proper modal (per MAINT-01 "popup").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal overlay | Custom portal/teleport | Inline `fixed inset-0` div (existing pattern) | UserProfileModal and SettingsModal already do this without portals; consistent approach |
| Persistent dismiss state | Custom storage abstraction | `localStorage` directly (or thin helper) | `useLocalStorage` hook exists but the dismissed map is write-once-per-interval, not reactive state — direct reads in helper functions are simpler |

**Key insight:** Every infrastructure piece is already present. This phase is pure feature assembly: arithmetic check + localStorage write + modal render.

## Common Pitfalls

### Pitfall 1: Reading Stale printHours for Before/After Comparison

**What goes wrong:** `printerInstances` from `useLiveQuery` (via `usePrinterInstances`) is React state. At the time `handleSaveJob` runs synchronously, `printerInstances` holds the pre-save values. After `await addPrintHours(...)` resolves, the Dexie update fires but the React re-render hasn't happened yet. So comparing `instance.printHours` *after* the await gives you the old value — not the new one.

**Why it happens:** IndexedDB write triggers Dexie's live query subscription asynchronously; the React re-render is batched after the current event.

**How to avoid:** Capture `hoursBefore = instance.printHours` BEFORE the awaits, then compute `hoursAfter = hoursBefore + printHours` from the argument. Do NOT await and then re-read from `printerInstances`.

**Warning signs:** Alert never fires, or fires on every save rather than only at boundary crossings.

### Pitfall 2: Edge Case — Job Save Where printHours Argument Is 0

**What goes wrong:** Some jobs may save with `printTimeHours: 0` (no time entered). The boundary check must guard against this to avoid a false alert.

**How to avoid:** Only run the boundary check when `printHours > 0`.

### Pitfall 3: Multiple Intervals Crossed in One Job

**What goes wrong:** A user enters a 1200-hour print job (unlikely but possible). The floor calculation `Math.floor(hoursAfter / 500)` may skip an intermediate boundary (e.g., crossing both 500 and 1000 in one save).

**How to avoid:** Alert for `lastIntervalAfter * INTERVAL` (the highest crossed multiple). Alerting for all crossed intervals in one save would require a loop and queuing — over-engineered for a corner case. Show the highest crossed interval; lower ones are implicitly subsumed. Document this as intended behavior.

**Warning signs:** If this is unacceptable, the alternative is queuing multiple alerts, but that requires a queue in state rather than a single `maintenanceAlert` object.

### Pitfall 4: NewBadge Requirement

**What goes wrong:** Forgetting to register the feature in `src/features.ts` and add `<NewBadge>` to the relevant UI element.

**How to avoid:** Per project MEMORY.md: every new feature gets a `NewBadge`. Add `'printer-maintenance-alerts'` to `featureReleases` in `src/features.ts`. Place `<NewBadge>` on the relevant element in the Printers tab (e.g., the tab label or the section heading).

## Code Examples

### Interval Boundary Detection (verified from project code reading)
```typescript
// Source: derived from PrinterInstance.printHours (types.ts:93) + addPrintHours (useDatabase.ts:211)
// Capture before-state from existing printerInstances hook state (pre-update value)
const instance = printerInstances.find(i => i.id === job.printerInstanceId);
const hoursBefore = instance?.printHours ?? 0;
const hoursAfter = hoursBefore + printHours;
const MAINTENANCE_INTERVAL = 500;
const intervalsBefore = Math.floor(hoursBefore / MAINTENANCE_INTERVAL);
const intervalsAfter = Math.floor(hoursAfter / MAINTENANCE_INTERVAL);

if (printHours > 0 && intervalsAfter > intervalsBefore && intervalsAfter > 0) {
  const crossedAt = intervalsAfter * MAINTENANCE_INTERVAL;
  if (!isDismissed(job.printerInstanceId, crossedAt)) {
    setMaintenanceAlert({ instanceId: job.printerInstanceId, hours: crossedAt });
  }
}
```

### localStorage Dismissed State (verified from NewBadge.tsx pattern)
```typescript
// Source: src/components/NewBadge.tsx pattern (localStorage, try/catch, JSON parse)
const MAINTENANCE_DISMISSED_KEY = '3dcoster-maintenance-dismissed';

function getMaintenanceDismissedMap(): Record<string, number[]> {
  try {
    return JSON.parse(localStorage.getItem(MAINTENANCE_DISMISSED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function isMaintenanceDismissed(instanceId: string, hours: number): boolean {
  return (getMaintenanceDismissedMap()[instanceId] ?? []).includes(hours);
}

function markMaintenanceDismissed(instanceId: string, hours: number): void {
  const map = getMaintenanceDismissedMap();
  map[instanceId] = [...(map[instanceId] ?? []).filter(h => h !== hours), hours];
  try {
    localStorage.setItem(MAINTENANCE_DISMISSED_KEY, JSON.stringify(map));
  } catch { /* localStorage full */ }
}
```

### Modal Shell (follows UserProfileModal.tsx pattern exactly)
```typescript
// Source: src/components/UserProfileModal.tsx — fixed overlay, backdrop click, Escape key
if (!alert) return null;
return (
  <div
    className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    onClick={e => { if (e.target === e.currentTarget) onDismiss(); }}
  >
    <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
      {/* header, body, dismiss button */}
    </div>
  </div>
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No maintenance tracking | printHours already accumulated per instance | Existing | Detection only needs arithmetic, not DB changes |

**No deprecated patterns apply** — this is a new feature with no prior implementation to replace.

## Open Questions

1. **What if a printer instance is deleted — should dismissed intervals be cleaned up from localStorage?**
   - What we know: The dismissed map is keyed by instanceId. Orphaned keys cause no harm (localStorage has ample space).
   - Recommendation: No cleanup needed for v1. Orphaned entries are harmless.

2. **Should the alert fire if the user manually edits printHours directly in PrinterSettings?**
   - What we know: `PrinterSettings.tsx` calls `onUpdateInstance` directly (not through `handleSaveJob`). The boundary check in `handleSaveJob` would not fire on manual edits.
   - What's unclear: Is that acceptable?
   - Recommendation: Ignore manual edits for v1. MAINT-01 says "when printer crosses 500h maintenance interval" — the natural trigger is job saves, not admin edits.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test config or test files exist in project |
| Config file | None — Wave 0 must create if tests are added |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAINT-01 | Alert fires when printHours crosses 500h multiple | unit | N/A — no test framework | Wave 0 gap |
| MAINT-02 | Dismissed interval does not re-trigger | unit | N/A — no test framework | Wave 0 gap |

### Sampling Rate
- **Per task commit:** Manual browser test — save a job on a printer near 500h
- **Per wave merge:** Full manual smoke: alert fires, dismiss persists across page reload, second interval triggers independently
- **Phase gate:** Manual verification before `/gsd:verify-work`

### Wave 0 Gaps

The project has no test infrastructure. Given the absence of a test framework, these requirements are covered by manual verification steps in PLAN.md. If test infrastructure is added:
- [ ] `tests/maintenance.test.ts` — unit tests for `isMaintenanceDismissed`, `markMaintenanceDismissed`, boundary detection arithmetic
- [ ] No framework install needed until test infrastructure is established

*(Existing projects have zero test files — manual verification is the current standard)*

## Sources

### Primary (HIGH confidence)
- `src/types.ts` — `PrinterInstance.printHours` field (line 93) confirmed exists
- `src/hooks/useDatabase.ts` — `addPrintHours` implementation (lines 211-219) confirmed
- `src/App.tsx` — `handleSaveJob` call site (line 108), `printerInstances` already in scope
- `src/components/UserProfileModal.tsx` — established modal pattern (overlay, Escape, backdrop click)
- `src/components/NewBadge.tsx` — established localStorage pattern (try/catch, JSON parse/stringify)
- `src/hooks/useLocalStorage.ts` — project's existing localStorage hook
- `src/features.ts` — NewBadge feature registry (must add entry per MEMORY.md requirement)

### Secondary (MEDIUM confidence)
- Project MEMORY.md: "Every new feature must get a NEW badge" — mandatory pattern
- `.planning/config.json`: `nyquist_validation: true` — validation section required

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all infrastructure verified by reading source
- Architecture: HIGH — detection pattern is arithmetic; modal and localStorage patterns directly traced from existing code
- Pitfalls: HIGH — stale React state timing pitfall confirmed by reading Dexie + React hook interaction; others verified from code review

**Research date:** 2026-04-15
**Valid until:** Stable — no external dependencies; valid until types.ts or useDatabase.ts are refactored

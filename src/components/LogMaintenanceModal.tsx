import { useEffect, useId, useState } from 'react';
import type { MaintenanceEvent, PrinterInstance } from '../types';
import { Button, Input, Modal, Select } from './ui';
import type { LogMaintenanceEventInput } from '../hooks/useMaintenanceEvents';

// ---------------------------------------------------------------------------
// LogMaintenanceModal — Phase 39 WEAR-01 (Plan 04 Task 2).
//
// Form modal for logging a maintenance event (nozzle/belt/bed/other swap)
// against a printer instance. Fields: partType, cost, occurredAt,
// printerHoursAtEvent (pre-filled with the instance's current printHours,
// editable). A nozzleType Select appears ONLY when partType === 'nozzle' —
// submitting a nozzle swap ALSO updates the PrinterInstance.nozzleType so the
// instance reflects what's actually installed (nozzle type lives on the
// physical instance per 39-RESEARCH.md Pitfall 6 / types.ts doc comment).
//
// Number.isFinite validation on cost/printerHoursAtEvent at the form boundary
// (T-39-10) — mirrors the guard already inside useMaintenanceEvents.
// ---------------------------------------------------------------------------

export interface LogMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  instance: PrinterInstance;
  onLogMaintenanceEvent: (input: LogMaintenanceEventInput) => Promise<string | undefined>;
  onUpdateInstanceNozzleType: (instanceId: string, nozzleType: 'brass' | 'hardened' | 'ruby') => void;
}

type PartType = MaintenanceEvent['partType'];

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function LogMaintenanceModal({
  isOpen,
  onClose,
  instance,
  onLogMaintenanceEvent,
  onUpdateInstanceNozzleType,
}: LogMaintenanceModalProps) {
  const [partType, setPartType] = useState<PartType>('nozzle');
  const [cost, setCost] = useState<number>(0);
  const [occurredAt, setOccurredAt] = useState<string>(() => toDateInputValue(new Date()));
  const [printerHoursAtEvent, setPrinterHoursAtEvent] = useState<number>(instance.printHours);
  const [nozzleType, setNozzleType] = useState<'brass' | 'hardened' | 'ruby'>(instance.nozzleType ?? 'brass');
  const [notes, setNotes] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const partTypeId = useId();
  const costId = useId();
  const dateId = useId();
  const hoursId = useId();
  const nozzleTypeId = useId();
  const notesId = useId();

  const canSave = Number.isFinite(cost) && cost >= 0 && Number.isFinite(printerHoursAtEvent) && printerHoursAtEvent >= 0;

  const resetForm = () => {
    setPartType('nozzle');
    setCost(0);
    setOccurredAt(toDateInputValue(new Date()));
    setPrinterHoursAtEvent(instance.printHours);
    setNozzleType(instance.nozzleType ?? 'brass');
    setNotes('');
    setSaveError(null);
  };

  // WR-02: re-seed from the LIVE instance whenever the modal transitions
  // closed -> open. The component stays permanently mounted inside
  // MaintenanceSection, so mount-time useState initializers alone would show
  // stale printHours/nozzleType after the instance changes (edited hours,
  // saved jobs bumping printHours) — and printerHoursAtEvent feeds the
  // next-swap interval math. Mirrors LogFailureModal's reset-on-open effect.
  useEffect(() => {
    if (!isOpen) return;
    resetForm();
    // Only re-seed on open (or when the target instance changes while open) —
    // not on every parent re-render while the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, instance.id]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) {
      setSaveError('Cost and printer hours must be valid, non-negative numbers.');
      return;
    }
    setSaveError(null);

    const id = await onLogMaintenanceEvent({
      printerInstanceId: instance.id,
      partType,
      cost,
      occurredAt: new Date(occurredAt),
      printerHoursAtEvent,
      nozzleType: partType === 'nozzle' ? nozzleType : undefined,
      notes: notes.trim() || undefined,
    });

    if (id === undefined) {
      setSaveError('Could not save this maintenance event — please check the values and try again.');
      return;
    }

    if (partType === 'nozzle') {
      onUpdateInstanceNozzleType(instance.id, nozzleType);
    }

    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Log Maintenance — ${instance.nickname}`}>
      <div className="p-4 space-y-4">
        <div>
          <label htmlFor={partTypeId} className="block text-xs text-slate-400 mb-1">Part</label>
          <Select id={partTypeId} value={partType} onChange={e => setPartType(e.target.value as PartType)}>
            <option value="nozzle">Nozzle</option>
            <option value="belt">Belt</option>
            <option value="bed">Bed</option>
            <option value="other">Other</option>
          </Select>
        </div>

        {partType === 'nozzle' && (
          <div>
            <label htmlFor={nozzleTypeId} className="block text-xs text-slate-400 mb-1">New Nozzle Type</label>
            <Select
              id={nozzleTypeId}
              value={nozzleType}
              onChange={e => setNozzleType(e.target.value as 'brass' | 'hardened' | 'ruby')}
            >
              <option value="brass">Brass</option>
              <option value="hardened">Hardened Steel</option>
              <option value="ruby">Ruby-Tipped</option>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={costId} className="block text-xs text-slate-400 mb-1">Cost ($)</label>
            <Input
              id={costId}
              type="number"
              compact
              min="0"
              value={cost}
              onChange={e => setCost(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div>
            <label htmlFor={dateId} className="block text-xs text-slate-400 mb-1">Date</label>
            <Input
              id={dateId}
              type="date"
              value={occurredAt}
              onChange={e => setOccurredAt(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor={hoursId} className="block text-xs text-slate-400 mb-1">Printer Hours at Event</label>
          <Input
            id={hoursId}
            type="number"
            compact
            min="0"
            value={printerHoursAtEvent}
            onChange={e => setPrinterHoursAtEvent(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div>
          <label htmlFor={notesId} className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
          <Input
            id={notesId}
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. worn tip, clog cleared"
          />
        </div>

        {saveError && (
          <p role="alert" className="text-sm text-red-400">{saveError}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="success" onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

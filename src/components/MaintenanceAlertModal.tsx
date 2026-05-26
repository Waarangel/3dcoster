import type { PrinterInstance } from '../types';
import { Button, Modal } from './ui';

interface MaintenanceAlertModalProps {
  alert: { instanceId: string; hours: number } | null;
  printerInstances: PrinterInstance[];
  onDismiss: () => void;
}

export function MaintenanceAlertModal({
  alert,
  printerInstances,
  onDismiss,
}: MaintenanceAlertModalProps) {
  const nickname =
    alert !== null
      ? (printerInstances.find(i => i.id === alert.instanceId)?.nickname ?? 'Unknown Printer')
      : '';

  const title = (
    <span className="flex items-center gap-3 text-amber-400">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      Maintenance Due
    </span>
  );

  return (
    <Modal isOpen={alert !== null} onClose={onDismiss} title={title} size="md">
      {/* Body */}
      <div className="p-5">
        <p className="text-slate-300 leading-relaxed">
          Your printer <span className="font-semibold text-white">{nickname}</span> has reached{' '}
          <span className="font-semibold text-white">{alert?.hours ?? 0} hours</span> of print time.
          Consider performing routine maintenance: nozzle inspection, lubrication, belt tension
          check, and cleaning.
        </p>
      </div>

      {/* Footer */}
      <div className="flex justify-end p-5 border-t border-slate-700">
        <Button onClick={onDismiss}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}

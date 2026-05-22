import { useEffect, useState } from 'react';
import type { Customer } from '../types';
import { Button, Input, Textarea } from './ui';

interface CustomerEditModalProps {
  isOpen: boolean;
  initialCustomer?: Customer;
  onSave: (customer: Customer) => Promise<void>;
  onClose: () => void;
}

export function CustomerEditModal({ isOpen, initialCustomer, onSave, onClose }: CustomerEditModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Hydrate from initialCustomer whenever it changes.
  // Keyed on initialCustomer?.id so switching edit→add or edit-A→edit-B refills cleanly.
  useEffect(() => {
    if (initialCustomer) {
      setName(initialCustomer.name ?? '');
      setEmail(initialCustomer.email ?? '');
      setCompany(initialCustomer.company ?? '');
      setAddress(initialCustomer.address ?? '');
      setNotes(initialCustomer.notes ?? '');
    } else {
      setName('');
      setEmail('');
      setCompany('');
      setAddress('');
      setNotes('');
    }
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomer?.id]);

  // Reset all state when the modal closes (mirrors CsvImportModal.tsx:33-43).
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setEmail('');
      setCompany('');
      setAddress('');
      setNotes('');
      setFormError(null);
      setIsSaving(false);
    }
  }, [isOpen]);

  // Close on Escape (mirrors CsvImportModal.tsx:46-53).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isEdit = initialCustomer !== undefined;
  const submitDisabled = (!name.trim() && !email.trim()) || isSaving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !email.trim()) {
      setFormError('Provide at least one of Name or Email to save.');
      return;
    }
    setFormError(null);
    setIsSaving(true);
    try {
      const id = initialCustomer?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `customer-${Date.now()}`);
      const customer: Customer = {
        id,
        createdAt: initialCustomer?.createdAt ?? new Date(),
        lastUsedAt: initialCustomer?.lastUsedAt,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      await onSave(customer);
      onClose();
    } catch {
      setFormError('Could not save customer. Try again — if it keeps failing, copy the values and refresh the page.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">
            {isEdit ? 'Edit customer' : 'Add customer'}
          </h3>
          <Button variant="ghost" btnSize="sm" onClick={onClose} aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Body */}
          <div className="p-4 space-y-4">
            {/* Required-field helper (always visible) */}
            <p className="text-xs text-slate-400 mb-2">Provide at least one of Name or Email.</p>

            {/* Form error banner */}
            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400">
                {formError}
              </div>
            )}

            {/* 1. Name (IN-03: no `*` — the rule is "Name OR Email", per the helper text above) */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <Input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            {/* 2. Email (IN-03: no `*` — the rule is "Name OR Email", per the helper text above) */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>

            {/* 3. Company */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Company</label>
              <Input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Acme Co."
              />
            </div>

            {/* 4. Address */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Address</label>
              <Textarea
                rows={3}
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            {/* 5. Notes */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Notes</label>
              <Textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Buyer preferences, packaging quirks, etc."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 pt-2 border-t border-slate-700">
            <Button variant="ghost" btnSize="md" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" btnSize="md" type="submit" disabled={submitDisabled}>
              {isSaving ? 'Saving...' : 'Save customer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

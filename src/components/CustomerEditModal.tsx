import { useEffect, useId, useRef, useState } from 'react';
import type { Customer } from '../types';
import { Button, Input, Textarea, Modal } from './ui';

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

  const nameId = useId();
  const emailId = useId();
  const companyId = useId();
  const addressId = useId();
  const notesId = useId();

  // WR-08 fix: hydrate on the isOpen transition (false → true) instead of on
  // `initialCustomer?.id` changes. The previous hook keyed solely on `.id`
  // missed in-place updates (same id, fresh fields — e.g. notes edited by a
  // refresh from Dexie) and required an eslint-disable for an inaccurate
  // dep array.
  //
  // The contract this modal actually has is: "open → snapshot initialCustomer
  // into local state; user edits without parent interference; close → discard
  // or save". Modal's HYG-09 child-unmount on close means a fresh mount runs
  // for every open, so a useRef-tracked transition is the spec-correct gate.
  const prevIsOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      // false → true transition: hydrate now.
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
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialCustomer]);

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
        email: email.trim().toLowerCase() || undefined,
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
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit customer' : 'Add customer'} size="md">
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
            <label htmlFor={nameId} className="block text-xs text-slate-400 mb-1">Name</label>
            <Input
              id={nameId}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* 2. Email (IN-03: no `*` — the rule is "Name OR Email", per the helper text above) */}
          <div>
            <label htmlFor={emailId} className="block text-xs text-slate-400 mb-1">Email</label>
            <Input
              id={emailId}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>

          {/* 3. Company */}
          <div>
            <label htmlFor={companyId} className="block text-xs text-slate-400 mb-1">Company</label>
            <Input
              id={companyId}
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Acme Co."
            />
          </div>

          {/* 4. Address */}
          <div>
            <label htmlFor={addressId} className="block text-xs text-slate-400 mb-1">Address</label>
            <Textarea
              id={addressId}
              rows={3}
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          {/* 5. Notes */}
          <div>
            <label htmlFor={notesId} className="block text-xs text-slate-400 mb-1">Notes</label>
            <Textarea
              id={notesId}
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
    </Modal>
  );
}

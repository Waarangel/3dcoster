import { memo, useCallback, useMemo, useState } from 'react';
import type { CSSProperties, SVGProps } from 'react';
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import type { Customer } from '../types';
import { Button, Input, EmptyState, Skeleton } from './ui';
import { SearchIcon } from './ui/icons';
import { CustomerEditModal } from './CustomerEditModal';
import { CustomerCsvImportModal } from './CustomerCsvImportModal';
import { db } from '../db/database';
import { formatRelativeDate } from '../utils/formatRelativeDate';

interface CustomerLibraryProps {
  customers: Customer[];
  isLoading: boolean;
  onAddCustomer: (c: Customer) => Promise<void>;
  onUpdateCustomer: (c: Customer) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  // Routed to CustomerCsvImportModal as `onImportCustomers` (Plan 03).
  onBulkImportCustomers: (toImport: Customer[]) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Module-scope row component (CR-01 fix). Stable identity across parent
// renders so react-window's internal memo wrapper caches correctly and rows
// only re-render when their own props change.
// ---------------------------------------------------------------------------

type CustomerRowCallbacks = {
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
};

type CustomerRowPropsForList = { customers: Customer[] } & CustomerRowCallbacks;

// CustomerRowItem — memoized inner component; receives a single Customer.
// Stable identity across parent renders so the wrapper adapter's invocations
// only re-render this row when its own props change.
const CustomerRowItem = memo(function CustomerRowItem({
  customer,
  style,
  onEdit,
  onDelete,
}: { customer: Customer; style?: CSSProperties } & CustomerRowCallbacks) {
  const subline = [customer.email, customer.company].filter(Boolean).join(' · ');
  const lastUsedLabel = `Last used: ${formatRelativeDate(customer.lastUsedAt)}`;
  return (
    <div role="listitem" style={style} className="pb-2">
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {customer.name || '(no name)'}
            </div>
            {subline && (
              <div className="text-sm text-slate-400 truncate">{subline}</div>
            )}
          </div>
          <div
            className="hidden sm:block text-sm text-slate-400 whitespace-nowrap"
            title={customer.lastUsedAt?.toISOString()}
          >
            {lastUsedLabel}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" btnSize="sm" onClick={() => onEdit(customer)}>
              <PencilIcon className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Edit</span>
            </Button>
            <Button
              variant="ghost"
              btnSize="sm"
              onClick={() => onDelete(customer)}
              className="text-red-400 hover:text-red-300"
            >
              <TrashIcon className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Delete</span>
            </Button>
          </div>
        </div>
        {/* Mobile collapses "Last used" below the subline */}
        <div className="sm:hidden mt-2 text-xs text-slate-500">
          {lastUsedLabel}
        </div>
      </div>
    </div>
  );
});

// Plain-function adapter (CR-01 — react-window v2 requires the rowComponent to
// be a function returning ReactElement | null, not a memo-wrapped exotic).
const CustomerRow = ({
  index,
  style,
  customers,
  onEdit,
  onDelete,
}: RowComponentProps<CustomerRowPropsForList>) => {
  const c = customers[index];
  if (!c) return null;
  return <CustomerRowItem customer={c} style={style as CSSProperties} onEdit={onEdit} onDelete={onDelete} />;
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CustomerLibrary({
  customers,
  isLoading,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onBulkImportCustomers,
}: CustomerLibraryProps) {
  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  const [isAdding, setIsAdding] = useState(false);
  // Reserved for Plan 03 — CSV importer modal mount lands there.
  // The `showCsvImport` value is referenced via `aria-pressed` on the Import CSV
  // button so TypeScript's `noUnusedLocals` is satisfied AND the visual state
  // (button "depressed" while modal is open) is already wired for Plan 03.
  const [showCsvImport, setShowCsvImport] = useState(false);

  // Sort: lastUsedAt desc with undefined (never-used) FIRST; tiebreaker name asc.
  // (UI-SPEC §2 — never-used floats so brand-new records don't disappear below regulars.)
  const sortedCustomers = useMemo(() => {
    const arr = [...customers];
    arr.sort((a, b) => {
      if (!a.lastUsedAt && !b.lastUsedAt) {
        return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
      }
      if (!a.lastUsedAt) return -1;
      if (!b.lastUsedAt) return 1;
      const diff = b.lastUsedAt.getTime() - a.lastUsedAt.getTime();
      if (diff !== 0) return diff;
      return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
    });
    return arr;
  }, [customers]);

  // Search filter (D-15: Name + Email + Company only — NOT Address, NOT Notes).
  const searchedCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sortedCustomers;
    return sortedCustomers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q)
    );
  }, [sortedCustomers, searchQuery]);

  // Dynamic row height — defaults to ~88 (two text lines + actions + 8px gap).
  // PERF-04 (D-22): pass `searchQuery` as a cache-invalidation key so row
  // heights recompute when the filter changes — mirrors the Phase 15 plan 04
  // D-05 bi-key pattern in JobsManager. Without this, search results inherit
  // stale row heights from the previous filter and visually drift.
  const customerRowHeightCache = useDynamicRowHeight({ defaultRowHeight: 88, key: searchQuery });

  // Handlers
  const handleAddClick = useCallback(() => {
    setIsAdding(true);
    setEditingCustomer(undefined);
  }, []);

  const handleEdit = useCallback((c: Customer) => {
    setEditingCustomer(c);
    setIsAdding(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsAdding(false);
    setEditingCustomer(undefined);
  }, []);

  const handleSaveFromModal = useCallback(async (customer: Customer) => {
    if (editingCustomer) {
      await onUpdateCustomer(customer);
    } else {
      await onAddCustomer(customer);
    }
  }, [editingCustomer, onAddCustomer, onUpdateCustomer]);

  // Delete confirm — count past sales by email at click time (D-14).
  // WR-02 fix: use Dexie's streaming filter + count instead of
  // materializing the entire sales table in memory. There is no email
  // index on db.sales, so the iteration still walks every record, but
  // .count() does not allocate a JS array — important for users with
  // thousands of sales on low-RAM devices.
  const handleDelete = useCallback(async (customer: Customer) => {
    const emailKey = (customer.email || '').trim().toLowerCase();
    const n = emailKey
      ? await db.sales
          .filter(s => (s.customer?.email || '').trim().toLowerCase() === emailKey)
          .count()
      : 0;
    const display = customer.name || customer.email || 'this customer';
    const message = n === 0
      ? `Delete ${display}? They have no past sales linked.`
      : `Delete ${display}? They appear in ${n} past sales — those sales will keep the buyer details on record (this only removes them from your library).`;
    if (window.confirm(message)) {
      await onDeleteCustomer(customer.id);
    }
  }, [onDeleteCustomer]);

  // Memoized listRowProps so <List> doesn't see a new object per render.
  const listRowProps = useMemo<CustomerRowPropsForList>(
    () => ({ customers: searchedCustomers, onEdit: handleEdit, onDelete: handleDelete }),
    [searchedCustomers, handleEdit, handleDelete]
  );

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      {/* Heading row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-white">Customers</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            btnSize="md"
            onClick={() => setShowCsvImport(true)}
            aria-pressed={showCsvImport}
            className="flex-1 sm:flex-none"
          >
            Import CSV
          </Button>
          <Button
            variant="primary"
            btnSize="md"
            onClick={handleAddClick}
            className="flex-1 sm:flex-none"
          >
            Add customer
          </Button>
        </div>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, or company"
          className="pl-9 pr-8 placeholder-slate-500"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            btnSize="sm"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg leading-none"
          >
            {'×'}
          </Button>
        )}
      </div>

      {/* Body branches */}
      {isLoading ? (
        <CustomerListSkeleton />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="w-12 h-12" />}
          title="No customers yet"
          description="Add your first customer to start saving buyer details for re-use on future sales."
          cta={{ label: 'Add customer', onClick: handleAddClick }}
        />
      ) : searchedCustomers.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-white">
            No customers match &quot;{searchQuery}&quot;
          </h3>
          <p className="text-sm text-slate-400 mt-2">
            Try a different name, email, or company.
          </p>
        </div>
      ) : (
        // WR-01 fix: aria-rowcount is only valid on grid/table/treegrid per
        // WAI-ARIA 1.2 — silently ignored on role="list". Screen readers
        // report list length without explicit annotation; aria-setsize on
        // each listitem is the spec-correct path if needed.
        <List
          role="list"
          rowComponent={CustomerRow}
          rowCount={searchedCustomers.length}
          rowHeight={customerRowHeightCache}
          rowProps={listRowProps}
          overscanCount={3}
          style={{ height: '70vh' }}
        />
      )}

      {/* Modal (single instance reused for Add + Edit) */}
      <CustomerEditModal
        isOpen={isAdding || editingCustomer !== undefined}
        initialCustomer={editingCustomer}
        onSave={handleSaveFromModal}
        onClose={handleCloseModal}
      />

      {/* CSV import modal (Plan 03) */}
      <CustomerCsvImportModal
        isOpen={showCsvImport}
        existingCustomers={customers}
        onImportCustomers={onBulkImportCustomers}
        onClose={() => setShowCsvImport(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — mirrors the real row shape (3 mobile cards / 5 desktop rows)
// ---------------------------------------------------------------------------

function CustomerListSkeleton() {
  return (
    <>
      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-2">
            <Skeleton variant="line" width="w-32" />
            <Skeleton variant="line" width="w-48" />
            <Skeleton variant="line" width="w-24" height="h-3" />
            <div className="flex gap-2 pt-2 border-t border-slate-700/50">
              <Skeleton variant="line" height="h-9" className="flex-1" />
              <Skeleton variant="line" height="h-9" className="flex-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop rows */}
      <div className="hidden sm:block space-y-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton variant="line" width="w-32" />
                <Skeleton variant="line" width="w-56" />
              </div>
              <Skeleton variant="line" width="w-28" />
              <div className="flex gap-1 shrink-0">
                <Skeleton variant="line" width="w-16" height="h-9" />
                <Skeleton variant="line" width="w-20" height="h-9" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons (Heroicons outline — project convention is per-file inline SVGs)
// ---------------------------------------------------------------------------

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.862 4.487zm0 0L19.5 7.125" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

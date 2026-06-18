import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAssets, useAllSettings, useJobs, usePrinters, usePrinterInstances, useUserProfile, useShippingConfig, useMarketplaceFees, useCustomers } from './hooks/useDatabase';
import { useFxRates } from './hooks/useFxRates';
import type { PrintJob } from './types';
import { AssetLibrary } from './components/AssetLibrary';
import { PrinterSettings } from './components/PrinterSettings';
import { CostCalculator } from './components/CostCalculator';
import { CustomerLibrary } from './components/CustomerLibrary';
import { JobsManager } from './components/JobsManager';
import { UserProfileModal } from './components/UserProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { MaintenanceAlertModal } from './components/MaintenanceAlertModal';
import { NewBadge } from './components/NewBadge';
import { Footer } from './components/Footer';
import { UpdateBanner } from './components/UpdateBanner';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { ToastProvider } from './components/ui';
import { isMaintenanceDismissed, markMaintenanceDismissed, MAINTENANCE_INTERVAL } from './utils/maintenanceDismissed';

type Tab = 'calculator' | 'jobs' | 'materials' | 'customers' | 'settings';

// Detect if running in standalone mode (PWA installed or Tauri desktop app)
function useIsStandalone(): boolean {
  // For Tauri builds, this is determined at build time
  if (__IS_TAURI__) {
    return true;
  }

  // For web, check PWA standalone mode (this is safe to check synchronously on first render)
  if (typeof window !== 'undefined') {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (navigator as { standalone?: boolean }).standalone === true;
    return isPWA || isIOSStandalone;
  }

  return false;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('calculator');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingJob, setEditingJob] = useState<PrintJob | null>(null);
  const [maintenanceAlert, setMaintenanceAlert] = useState<{ instanceId: string; hours: number } | null>(null);
  const isStandalone = useIsStandalone();

  // Database hooks
  const {
    assets,
    isLoading: assetsLoading,
    error: assetsError,
    addAsset,
    updateAsset,
    deleteAsset,
    bulkImportAssets,
    resetMaterialsOnly,
    resetPrintersOnly,
  } = useAssets();

  // Filter materials (non-printer assets) for components that need them.
  // IN-05: useMemo'd to stabilize the array reference across renders. Without
  // the memo, every App render produces a fresh `materials` reference and
  // passes it to CostCalculator, JobsManager, and AssetLibrary, invalidating
  // any downstream memoization that takes `materials` in a deps array. Phase 9
  // removed the global loading gate, so App now renders more frequently —
  // this is hot enough to be worth stabilizing.
  const materials = useMemo(
    () => assets.filter(a => a.category !== 'printer'),
    [assets]
  );

  const {
    customers,
    isLoading: customersLoading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    bulkImportCustomers,
  } = useCustomers();

  const {
    electricity,
    updateElectricity,
  } = useAllSettings();

  const {
    jobs,
    isLoading: jobsLoading,
    addJob,
    updateJob,
    deleteJob,
  } = useJobs();

  const {
    printers,
    addPrinter,
  } = usePrinters();

  const {
    instances: printerInstances,
    isLoading: instancesLoading,
    addInstance,
    updateInstance,
    deleteInstance,
    addPrintHours,
  } = usePrinterInstances();

  const {
    profile: userProfile,
    updateProfile: updateUserProfile,
  } = useUserProfile();

  // Cached USD-based FX rate table for display-time currency conversion. Shared
  // by the calculator and asset library so every price renders in the user's
  // currency regardless of the price's native currency.
  const fxTable = useFxRates();

  const {
    shipping: shippingConfig,
    updateShipping: updateShippingConfig,
  } = useShippingConfig();

  const {
    fees: marketplaceFees,
    updateFees: updateMarketplaceFees,
    resetToDefaults: resetMarketplaceFees,
  } = useMarketplaceFees();

  // Handle saving a job and updating printer hours
  const handleSaveJob = async (job: PrintJob, printHours: number) => {
    // Capture hours BEFORE the update (printerInstances holds pre-update values)
    const instance = printerInstances.find(i => i.id === job.printerInstanceId);
    const hoursBefore = instance?.printHours ?? 0;

    await addJob(job);
    await addPrintHours(job.printerInstanceId, printHours);

    // Detect 500h interval boundary crossing
    if (printHours > 0) {
      const hoursAfter = hoursBefore + printHours;
      const intervalsBefore = Math.floor(hoursBefore / MAINTENANCE_INTERVAL);
      const intervalsAfter = Math.floor(hoursAfter / MAINTENANCE_INTERVAL);

      if (intervalsAfter > intervalsBefore && intervalsAfter > 0) {
        const crossedAt = intervalsAfter * MAINTENANCE_INTERVAL;
        if (!isMaintenanceDismissed(job.printerInstanceId, crossedAt)) {
          setMaintenanceAlert({ instanceId: job.printerInstanceId, hours: crossedAt });
        }
      }
    }
  };

  // Handle editing a job - switch to calculator and load job data
  const handleEditJob = (job: PrintJob) => {
    setEditingJob(job);
    setActiveTab('calculator');
  };

  const handleCancelEdit = () => {
    setEditingJob(null);
  };

  // Phase 16 gap closure plan 16-10: the lifetime quote-number counter increment
  // site has MOVED from this `handlePersistQuoteNumber` helper into the
  // `createQuote` hook action in `useDatabase.ts`. The hook now owns the
  // atomic multi-store transaction (quotes + customers + settings); App.tsx
  // no longer needs to drive that write path.

  const tabs: { id: Tab; label: string; shortLabel: string }[] = [
    { id: 'calculator', label: 'Cost Calculator', shortLabel: 'Calculator' },
    { id: 'jobs', label: 'My Jobs', shortLabel: 'Jobs' },
    { id: 'materials', label: 'Asset Library', shortLabel: 'Assets' },
    { id: 'customers', label: 'Customers', shortLabel: 'Customers' },
    { id: 'settings', label: 'Printers', shortLabel: 'Printers' },
  ];

  return (
    <ToastProvider>
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Update Banner (desktop only) */}
      <UpdateBanner />

      {/* Survey / announcement banner (remote-config driven) */}
      <AnnouncementBanner />

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/3DCosterLogoWithWords.svg"
              alt="3DCoster"
              className="h-10 sm:h-12 w-auto"
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {!isStandalone && (
              <Link
                to="/"
                className="flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm min-w-[44px] min-h-[44px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden sm:inline">Back to site</span>
              </Link>
            )}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="relative p-2 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Settings"
              aria-label="Open settings"
            >
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <NewBadge feature="settings-reorg" className="absolute -top-1 -right-1" />
            </button>
            <button
              onClick={() => setShowProfileModal(true)}
              className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="User Settings"
              aria-label="Open user profile"
            >
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        userProfile={userProfile}
        onProfileChange={updateUserProfile}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        electricity={electricity}
        shippingConfig={shippingConfig}
        marketplaceFees={marketplaceFees}
        userCurrency={userProfile.currency}
        userProfile={userProfile}
        onElectricityChange={updateElectricity}
        onShippingChange={updateShippingConfig}
        onMarketplaceFeesChange={updateMarketplaceFees}
        onResetMarketplaceFees={resetMarketplaceFees}
        onUserProfileChange={updateUserProfile}
      />

      {/* Maintenance Alert Modal */}
      <MaintenanceAlertModal
        alert={maintenanceAlert}
        printerInstances={printerInstances}
        onDismiss={() => {
          if (maintenanceAlert) {
            markMaintenanceDismissed(maintenanceAlert.instanceId, maintenanceAlert.hours);
          }
          setMaintenanceAlert(null);
        }}
      />

      {/* Tabs */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 flex-nowrap" role="tablist" aria-label="Main navigation">
            {tabs.map(tab => (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls="app-tabpanel"
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap min-h-[44px] flex items-center gap-1 ${
                  activeTab === tab.id
                    ? 'text-blue-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
                {/* Phase 15.1 NEW badge — only on the Customers tab. Absolute overlay so it never displaces siblings. */}
                {tab.id === 'customers' && (
                  <NewBadge feature="customer-library" className="absolute -top-1 -right-1 pointer-events-none" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main
        className="max-w-6xl mx-auto px-4 py-6"
        role="tabpanel"
        id="app-tabpanel"
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'calculator' && (
          <CostCalculator
            materials={materials}
            printers={printers}
            printerInstances={printerInstances}
            electricity={electricity}
            laborHourlyRate={userProfile.laborHourlyRate}
            defaultProfitMargin={userProfile.defaultProfitMargin ?? 30}
            userCurrency={userProfile.currency}
            userProfile={userProfile}
            fxTable={fxTable}
            shippingConfig={shippingConfig}
            marketplaceFees={marketplaceFees}
            onSaveJob={handleSaveJob}
            onUpdateJob={updateJob}
            editingJob={editingJob}
            onCancelEdit={handleCancelEdit}
          />
        )}

        {activeTab === 'jobs' && (
          <JobsManager
            jobs={jobs}
            isLoading={jobsLoading}
            materials={materials}
            shippingConfig={shippingConfig}
            userCurrency={userProfile.currency}
            userProfile={userProfile}
            fxTable={fxTable}
            onDeleteJob={deleteJob}
            onEditJob={handleEditJob}
            onSwitchTab={setActiveTab}
          />
        )}

        {activeTab === 'materials' && (
          <AssetLibrary
            assets={assets}
            isLoading={assetsLoading}
            loadError={assetsError}
            onAddAsset={addAsset}
            onUpdateAsset={updateAsset}
            onDeleteAsset={deleteAsset}
            onBulkImportAssets={bulkImportAssets}
            onResetMaterials={resetMaterialsOnly}
            onResetPrinters={resetPrintersOnly}
            itemsPerPage={userProfile.assetLibraryItemsPerPage ?? 10}
            onItemsPerPageChange={(value) => updateUserProfile({ ...userProfile, assetLibraryItemsPerPage: value })}
            userCurrency={userProfile.currency}
            fxTable={fxTable}
          />
        )}

        {activeTab === 'customers' && (
          <CustomerLibrary
            customers={customers}
            isLoading={customersLoading}
            onAddCustomer={addCustomer}
            onUpdateCustomer={updateCustomer}
            onDeleteCustomer={deleteCustomer}
            onBulkImportCustomers={bulkImportCustomers}
          />
        )}

        {activeTab === 'settings' && (
          <PrinterSettings
            printers={printers}
            printerInstances={printerInstances}
            isLoading={instancesLoading}
            jobs={jobs}
            userCurrency={userProfile.currency}
            onAddInstance={addInstance}
            onUpdateInstance={updateInstance}
            onDeleteInstance={deleteInstance}
            onAddPrinter={addPrinter}
          />
        )}
      </main>

      <Footer variant="minimal" />
    </div>
    </ToastProvider>
  );
}

export default App;

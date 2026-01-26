import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAssets, useAllSettings, useJobs, usePrinters, usePrinterInstances, useUserProfile, useShippingConfig, useMarketplaceFees } from './hooks/useDatabase';
import type { PrintJob } from './types';
import { AssetLibrary } from './components/AssetLibrary';
import { PrinterSettings } from './components/PrinterSettings';
import { CostCalculator } from './components/CostCalculator';
import { JobsManager } from './components/JobsManager';
import { UserProfileModal } from './components/UserProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { NewBadge } from './components/NewBadge';
import { Footer } from './components/Footer';
import { UpdateBanner } from './components/UpdateBanner';

type Tab = 'calculator' | 'jobs' | 'materials' | 'settings';

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
  const isStandalone = useIsStandalone();

  // Database hooks
  const {
    assets,
    isLoading: assetsLoading,
    addAsset,
    updateAsset,
    deleteAsset,
    resetMaterialsOnly,
    resetPrintersOnly,
  } = useAssets();

  // Filter materials (non-printer assets) for components that need them
  const materials = assets.filter(a => a.category !== 'printer');

  const {
    electricity,
    updateElectricity,
    isLoading: settingsLoading,
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
    isLoading: printersLoading,
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
    isLoading: profileLoading,
  } = useUserProfile();

  const {
    shipping: shippingConfig,
    updateShipping: updateShippingConfig,
    isLoading: shippingLoading,
  } = useShippingConfig();

  const {
    fees: marketplaceFees,
    updateFees: updateMarketplaceFees,
    resetToDefaults: resetMarketplaceFees,
    isLoading: feesLoading,
  } = useMarketplaceFees();

  const isLoading = assetsLoading || settingsLoading || jobsLoading || printersLoading || instancesLoading || profileLoading || shippingLoading || feesLoading;

  // Handle saving a job and updating printer hours
  const handleSaveJob = async (job: PrintJob, printHours: number) => {
    await addJob(job);
    await addPrintHours(job.printerInstanceId, printHours);
  };

  // Handle editing a job - switch to calculator and load job data
  const handleEditJob = (job: PrintJob) => {
    setEditingJob(job);
    setActiveTab('calculator');
  };

  const handleCancelEdit = () => {
    setEditingJob(null);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'calculator', label: 'Cost Calculator' },
    { id: 'jobs', label: 'My Jobs' },
    { id: 'materials', label: 'Asset Library' },
    { id: 'settings', label: 'Printer Settings' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Update Banner (desktop only) */}
      <UpdateBanner />

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/pwa-192x192.png" alt="3DCoster" className="w-12 h-12 rounded-xl" />
            <div>
              <h1 className="text-2xl font-bold text-white">3D Print Cost Calculator</h1>
              <p className="text-slate-400 text-sm mt-1">Calculate your true cost per print</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isStandalone && (
              <Link
                to="/"
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to site</span>
              </Link>
            )}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="relative p-2 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
              title="Settings"
            >
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <NewBadge feature="settings-modal" className="absolute -top-1 -right-1" />
            </button>
            <button
              onClick={() => setShowProfileModal(true)}
              className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
              title="User Settings"
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
        shippingConfig={shippingConfig}
        marketplaceFees={marketplaceFees}
        userCurrency={userProfile.currency}
        onShippingChange={updateShippingConfig}
        onMarketplaceFeesChange={updateMarketplaceFees}
        onResetMarketplaceFees={resetMarketplaceFees}
      />

      {/* Tabs */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-blue-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'calculator' && (
          <CostCalculator
            materials={materials}
            printers={printers}
            printerInstances={printerInstances}
            electricity={electricity}
            laborHourlyRate={userProfile.laborHourlyRate}
            userCurrency={userProfile.currency}
            shippingConfig={shippingConfig}
            onSaveJob={handleSaveJob}
            onUpdateJob={updateJob}
            editingJob={editingJob}
            onCancelEdit={handleCancelEdit}
          />
        )}

        {activeTab === 'jobs' && (
          <JobsManager
            jobs={jobs}
            materials={materials}
            printers={printers}
            printerInstances={printerInstances}
            shippingConfig={shippingConfig}
            userCurrency={userProfile.currency}
            onDeleteJob={deleteJob}
            onEditJob={handleEditJob}
          />
        )}

        {activeTab === 'materials' && (
          <AssetLibrary
            assets={assets}
            onAddAsset={addAsset}
            onUpdateAsset={updateAsset}
            onDeleteAsset={deleteAsset}
            onResetMaterials={resetMaterialsOnly}
            onResetPrinters={resetPrintersOnly}
            itemsPerPage={userProfile.assetLibraryItemsPerPage ?? 10}
            onItemsPerPageChange={(value) => updateUserProfile({ ...userProfile, assetLibraryItemsPerPage: value })}
          />
        )}

        {activeTab === 'settings' && (
          <PrinterSettings
            printers={printers}
            printerInstances={printerInstances}
            jobs={jobs}
            electricity={electricity}
            onAddInstance={addInstance}
            onUpdateInstance={updateInstance}
            onDeleteInstance={deleteInstance}
            onElectricityChange={updateElectricity}
          />
        )}
      </main>

      <Footer variant="minimal" />
    </div>
  );
}

export default App;

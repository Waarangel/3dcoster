import { useEffect, useMemo, useRef, useState } from 'react';
import type { Currency, ElectricityConfig, ShippingConfig, CustomCarrier, MarketplaceFees, CustomMarketplace, UserProfile } from '../types';
import { CURRENCY_CONFIG, getDistanceUnit, getFuelUnit, kmToMiles, milesToKm, litersPer100KmToMpg, mpgToLitersPer100Km } from '../utils/currency';
import { resolveTaxRate } from '../utils/taxResolution';
import { US_MARKETPLACE_FACILITATOR_NOTE } from '../data/taxRates';
import { NewBadge } from './NewBadge';
import { Button, Input } from './ui';
import { InfoTooltip } from './ui/InfoTooltip';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  electricity: ElectricityConfig;
  shippingConfig: ShippingConfig;
  marketplaceFees: MarketplaceFees;
  userCurrency: Currency;
  userProfile: UserProfile;
  onElectricityChange: (config: ElectricityConfig) => void;
  onShippingChange: (config: ShippingConfig) => void;
  onMarketplaceFeesChange: (fees: MarketplaceFees) => void;
  onResetMarketplaceFees: () => void;
  onUserProfileChange: (profile: UserProfile) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  electricity,
  shippingConfig,
  marketplaceFees,
  userCurrency,
  userProfile,
  onElectricityChange,
  onShippingChange,
  onMarketplaceFeesChange,
  onResetMarketplaceFees,
  onUserProfileChange,
}: SettingsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const currencySymbol = CURRENCY_CONFIG[userCurrency].symbol;
  const distanceUnit = getDistanceUnit(userCurrency);
  const fuelUnit = getFuelUnit(userCurrency);

  // Default Tax Rate placeholder — shows the region default that would apply
  // if the user leaves Settings empty. Makes the fallback visible at the input
  // surface instead of requiring users to discover it via the per-job tooltip.
  const regionTaxRate = useMemo(
    () => resolveTaxRate({
      jobOverride: undefined,
      settingsDefault: undefined,
      currency: userCurrency,
    }).rate,
    [userCurrency]
  );

  // Tab state — 3-tab IA: Costs & Rates (all cost inputs), Delivery (local + carriers), Marketplaces
  const [activeTab, setActiveTab] = useState<'costs' | 'delivery' | 'marketplaces'>('costs');

  // Custom carrier form state
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierCost, setNewCarrierCost] = useState('');
  const [editingCarrierId, setEditingCarrierId] = useState<string | null>(null);

  // Custom marketplace form state
  const [newMarketplaceName, setNewMarketplaceName] = useState('');
  const [newMarketplacePercent, setNewMarketplacePercent] = useState('');
  const [newMarketplaceFixed, setNewMarketplaceFixed] = useState('');
  const [editingMarketplaceId, setEditingMarketplaceId] = useState<string | null>(null);

  // Reset edit state when switching tabs
  useEffect(() => {
    setEditingCarrierId(null);
    setEditingMarketplaceId(null);
  }, [activeTab]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Add custom carrier
  const handleAddCarrier = () => {
    if (!newCarrierName.trim() || !newCarrierCost) return;

    const parsedCost = parseFloat(newCarrierCost) || 0;
    const newCarrier: CustomCarrier = {
      id: `carrier-${Date.now()}`,
      name: newCarrierName.trim(),
      defaultCost: Math.max(0, parsedCost),
    };

    onShippingChange({
      ...shippingConfig,
      customCarriers: [...(shippingConfig.customCarriers || []), newCarrier],
    });

    setNewCarrierName('');
    setNewCarrierCost('');
  };

  // Update custom carrier
  const handleUpdateCarrier = (id: string, field: keyof CustomCarrier, value: string | number) => {
    const updated = (shippingConfig.customCarriers || []).map(c =>
      c.id === id ? { ...c, [field]: value } : c
    );
    onShippingChange({ ...shippingConfig, customCarriers: updated });
  };

  // Delete custom carrier
  const handleDeleteCarrier = (id: string) => {
    const updated = (shippingConfig.customCarriers || []).filter(c => c.id !== id);
    onShippingChange({ ...shippingConfig, customCarriers: updated });
  };

  // Add custom marketplace
  const handleAddMarketplace = () => {
    if (!newMarketplaceName.trim()) return;

    const newMarketplace: CustomMarketplace = {
      id: `marketplace-${Date.now()}`,
      name: newMarketplaceName.trim(),
      feePercent: Math.max(0, parseFloat(newMarketplacePercent) || 0),
      fixedFee: Math.max(0, parseFloat(newMarketplaceFixed) || 0),
    };

    onMarketplaceFeesChange({
      ...marketplaceFees,
      customMarketplaces: [...(marketplaceFees.customMarketplaces || []), newMarketplace],
    });

    setNewMarketplaceName('');
    setNewMarketplacePercent('');
    setNewMarketplaceFixed('');
  };

  // Update custom marketplace
  const handleUpdateMarketplace = (id: string, field: keyof CustomMarketplace, value: string | number) => {
    const updated = (marketplaceFees.customMarketplaces || []).map(m =>
      m.id === id ? { ...m, [field]: value } : m
    );
    onMarketplaceFeesChange({ ...marketplaceFees, customMarketplaces: updated });
  };

  // Delete custom marketplace
  const handleDeleteMarketplace = (id: string) => {
    const updated = (marketplaceFees.customMarketplaces || []).filter(m => m.id !== id);
    onMarketplaceFeesChange({ ...marketplaceFees, customMarketplaces: updated });
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'costs' as const, label: 'Costs & Rates' },
    { id: 'delivery' as const, label: 'Delivery' },
    { id: 'marketplaces' as const, label: 'Marketplaces' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-end p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg mt-12 mr-2 max-h-[calc(100vh-100px)] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <Button variant="ghost" btnSize="sm" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {tabs.map(tab => (
            // allow-raw-html: tab buttons use dynamic active/inactive class with border-b-2 indicator that no Button variant maps to (Pitfall 4)
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center ${
                activeTab === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400 -mb-[1px]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Costs & Rates Tab — all global cost inputs that feed job math */}
          {activeTab === 'costs' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">Electricity</h3>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <span>Cost per kWh ({currencySymbol})</span>
                    <InfoTooltip text="Used to calculate the electricity cost of every print, based on each printer's wattage and your print time." />
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    compact
                    value={electricity.costPerKwh}
                    onChange={e => onElectricityChange({ costPerKwh: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Your Hourly Rate</h3>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <span>Hourly Rate ({currencySymbol})</span>
                    <InfoTooltip text="Value your time! Applied to prep, monitoring, and post-processing minutes you log on each job." />
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    compact
                    value={userProfile.laborHourlyRate || ''}
                    onChange={e => onUserProfileChange({ ...userProfile, laborHourlyRate: parseFloat(e.target.value) || 0 })}
                    placeholder="20"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3 relative inline-block">
                  Default Profit Margin
                  <NewBadge feature="default-profit-margin" className="absolute top-0 left-full ml-2 pointer-events-none" />
                </h3>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <span>Profit Margin (%)</span>
                    <InfoTooltip text="Applied to new jobs and when the form is cleared or a job is saved. You can still adjust the margin per job in the calculator." />
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="99.9"
                    compact
                    value={userProfile.defaultProfitMargin ?? 30}
                    onChange={e => {
                      const parsed = parseFloat(e.target.value);
                      const next = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 99.9) : 0;
                      onUserProfileChange({ ...userProfile, defaultProfitMargin: next });
                    }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3 relative inline-block">
                  Default Tax Rate
                  <NewBadge feature="default-tax-rate" className="absolute top-0 left-full ml-2 pointer-events-none" />
                </h3>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <span>Tax Rate (%)</span>
                    <InfoTooltip
                      text={
                        userCurrency === 'USD'
                          ? US_MARKETPLACE_FACILITATOR_NOTE
                          : 'Default tax rate applied to new jobs. Override per-job in the calculator.'
                      }
                    />
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="99.9"
                    compact
                    placeholder={regionTaxRate > 0 ? String(regionTaxRate) : 'e.g., 20'}
                    value={userProfile.defaultTaxRate ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '') {
                        onUserProfileChange({ ...userProfile, defaultTaxRate: undefined });
                      } else {
                        const parsed = parseFloat(v);
                        if (Number.isFinite(parsed)) {
                          onUserProfileChange({ ...userProfile, defaultTaxRate: Math.min(Math.max(parsed, 0), 99.9) });
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {regionTaxRate > 0
                      ? `Region default: ${regionTaxRate}% — leave blank to inherit.`
                      : 'No region default for your currency. Enter manually.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Tab — local pickup/dropoff + carrier base rates merged */}
          {activeTab === 'delivery' && (
            <div className="space-y-6">
              {/* Local Delivery Settings — flex-wrap so chunks tight-pack */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">Local Pickup & Dropoff</h3>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Max Radius ({distanceUnit})</label>
                    <Input
                      type="number"
                      compact
                      value={distanceUnit === 'mi' ? kmToMiles(shippingConfig.maxDeliveryRadiusKm).toFixed(1) : shippingConfig.maxDeliveryRadiusKm}
                      onChange={e => {
                        const inputVal = parseFloat(e.target.value) || 0;
                        onShippingChange({ ...shippingConfig, maxDeliveryRadiusKm: distanceUnit === 'mi' ? milesToKm(inputVal) : inputVal });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Fuel Price ({currencySymbol}/{fuelUnit})</label>
                    <Input
                      type="number"
                      step="0.01"
                      compact
                      value={shippingConfig.gasPricePerLiter}
                      onChange={e => onShippingChange({ ...shippingConfig, gasPricePerLiter: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{fuelUnit === 'gal' ? 'MPG' : 'L/100km'}</label>
                    <Input
                      type="number"
                      step="0.1"
                      compact
                      value={fuelUnit === 'gal' ? litersPer100KmToMpg(shippingConfig.vehicleFuelEfficiency).toFixed(1) : shippingConfig.vehicleFuelEfficiency}
                      onChange={e => {
                        const inputVal = parseFloat(e.target.value) || 0;
                        onShippingChange({ ...shippingConfig, vehicleFuelEfficiency: fuelUnit === 'gal' ? mpgToLitersPer100Km(inputVal) : inputVal });
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {fuelUnit === 'gal'
                    ? 'Dropoff cost = (distance × 2) ÷ MPG × fuel price'
                    : 'Dropoff cost = (distance × 2) × (L/100km ÷ 100) × fuel price'}
                </p>
              </div>

              {/* Built-in Carriers — merged from former Carriers tab */}
              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Typical Carrier Costs</h3>
                <p className="text-xs text-slate-500 mb-3">These auto-fill in the calculator. Override per-order as needed.</p>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">UPS ({currencySymbol})</label>
                    <Input
                      type="number"
                      step="0.01"
                      compact
                      value={shippingConfig.upsBaseCost}
                      onChange={e => onShippingChange({ ...shippingConfig, upsBaseCost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">FedEx ({currencySymbol})</label>
                    <Input
                      type="number"
                      step="0.01"
                      compact
                      value={shippingConfig.fedexBaseCost}
                      onChange={e => onShippingChange({ ...shippingConfig, fedexBaseCost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">DHL ({currencySymbol})</label>
                    <Input
                      type="number"
                      step="0.01"
                      compact
                      value={shippingConfig.dhlBaseCost}
                      onChange={e => onShippingChange({ ...shippingConfig, dhlBaseCost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {userCurrency === 'CAD' && (
                    <>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Canada Post ({currencySymbol})</label>
                        <Input
                          type="number"
                          step="0.01"
                          compact
                          value={shippingConfig.canadaPostBaseCost}
                          onChange={e => onShippingChange({ ...shippingConfig, canadaPostBaseCost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Purolator ({currencySymbol})</label>
                        <Input
                          type="number"
                          step="0.01"
                          compact
                          value={shippingConfig.purolatorBaseCost}
                          onChange={e => onShippingChange({ ...shippingConfig, purolatorBaseCost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </>
                  )}
                  {userCurrency === 'USD' && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">USPS ({currencySymbol})</label>
                      <Input
                        type="number"
                        step="0.01"
                        compact
                        value={shippingConfig.uspsBaseCost}
                        onChange={e => onShippingChange({ ...shippingConfig, uspsBaseCost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  )}
                  {userCurrency === 'GBP' && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Royal Mail ({currencySymbol})</label>
                      <Input
                        type="number"
                        step="0.01"
                        compact
                        value={shippingConfig.royalMailBaseCost}
                        onChange={e => onShippingChange({ ...shippingConfig, royalMailBaseCost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  )}
                  {(userCurrency === 'AUD' || userCurrency === 'NZD') && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Australia Post ({currencySymbol})</label>
                      <Input
                        type="number"
                        step="0.01"
                        compact
                        value={shippingConfig.australiaPostBaseCost}
                        onChange={e => onShippingChange({ ...shippingConfig, australiaPostBaseCost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Carriers */}
              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Custom Carriers</h3>
                <p className="text-xs text-slate-500 mb-3">Add carriers specific to your region.</p>

                {/* Existing custom carriers */}
                {shippingConfig.customCarriers && shippingConfig.customCarriers.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {shippingConfig.customCarriers.map(carrier => (
                      <div key={carrier.id} className="flex items-center gap-2 bg-slate-700/50 p-2 rounded-lg">
                        {editingCarrierId === carrier.id ? (
                          <>
                            <Input
                              type="text"
                              value={carrier.name}
                              onChange={e => handleUpdateCarrier(carrier.id, 'name', e.target.value)}
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              compact
                              value={carrier.defaultCost}
                              onChange={e => handleUpdateCarrier(carrier.id, 'defaultCost', Math.max(0, parseFloat(e.target.value) || 0))}
                              className="text-right"
                            />
                            <Button
                              variant="ghost"
                              btnSize="sm"
                              onClick={() => setEditingCarrierId(null)}
                              className="text-green-400 hover:text-green-300"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-white">{carrier.name}</span>
                            <span className="text-sm text-slate-300 font-mono">{currencySymbol}{carrier.defaultCost.toFixed(2)}</span>
                            <Button
                              variant="ghost"
                              btnSize="sm"
                              onClick={() => setEditingCarrierId(carrier.id)}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </Button>
                            <Button
                              variant="danger"
                              btnSize="sm"
                              onClick={() => handleDeleteCarrier(carrier.id)}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new carrier — grid keeps name wide and cost narrow regardless of modal width */}
                <div className="grid grid-cols-[1fr_5rem_auto] gap-2">
                  <Input
                    type="text"
                    placeholder="Carrier name"
                    value={newCarrierName}
                    onChange={e => setNewCarrierName(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    compact
                    placeholder={currencySymbol}
                    value={newCarrierCost}
                    onChange={e => setNewCarrierCost(e.target.value)}
                  />
                  <Button
                    onClick={handleAddCarrier}
                    disabled={!newCarrierName.trim() || !newCarrierCost}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Marketplaces Tab */}
          {activeTab === 'marketplaces' && (
            <div className="space-y-6">
              {/* Info about fees */}
              <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600">
                <p className="text-xs text-slate-400">
                  All fees are in your local currency ({currencySymbol}). Update these if platforms change their rates.
                </p>
              </div>

              {/* Facebook Marketplace */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3">Facebook Marketplace</h3>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Selling Fee (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      compact
                      value={marketplaceFees.facebookShippedPercent}
                      onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, facebookShippedPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Min Fee ({currencySymbol})</label>
                    <Input
                      type="number"
                      step="0.01"
                      compact
                      value={marketplaceFees.facebookMinFee}
                      onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, facebookMinFee: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Processing (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      compact
                      value={marketplaceFees.facebookProcessingPercent}
                      onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, facebookProcessingPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              {/* Etsy */}
              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Etsy</h3>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Transaction Fee (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      compact
                      value={marketplaceFees.etsyTransactionPercent}
                      onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, etsyTransactionPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Payment Fee (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      compact
                      value={marketplaceFees.etsyPaymentPercent}
                      onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, etsyPaymentPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Payment Fixed ({currencySymbol})</label>
                    <Input
                      type="number"
                      step="0.01"
                      compact
                      value={marketplaceFees.etsyPaymentFixed}
                      onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, etsyPaymentFixed: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Listing Fee ({currencySymbol})</label>
                    <Input
                      type="number"
                      step="0.01"
                      compact
                      value={marketplaceFees.etsyListingFee}
                      onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, etsyListingFee: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Offsite Ads Fee (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      compact
                      value={marketplaceFees.etsyOffsiteAdPercent}
                      onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, etsyOffsiteAdPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              {/* eBay */}
              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">eBay</h3>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Final Value Fee (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      compact
                      value={marketplaceFees.ebayFinalValuePercent}
                      onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, ebayFinalValuePercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Fixed Fee ({currencySymbol})</label>
                    <Input
                      type="number"
                      step="0.01"
                      compact
                      value={marketplaceFees.ebayFixedFee}
                      onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, ebayFixedFee: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              {/* Amazon Handmade */}
              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Amazon Handmade</h3>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Referral Fee (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    compact
                    value={marketplaceFees.amazonHandmadePercent}
                    onChange={e => onMarketplaceFeesChange({ ...marketplaceFees, amazonHandmadePercent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Custom Marketplaces */}
              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Custom Marketplaces</h3>
                <p className="text-xs text-slate-500 mb-3">Add marketplaces specific to your region or niche.</p>

                {/* Existing custom marketplaces */}
                {marketplaceFees.customMarketplaces && marketplaceFees.customMarketplaces.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {marketplaceFees.customMarketplaces.map(mp => (
                      <div key={mp.id} className="flex items-center gap-2 bg-slate-700/50 p-2 rounded-lg">
                        {editingMarketplaceId === mp.id ? (
                          <>
                            <Input
                              type="text"
                              value={mp.name}
                              onChange={e => handleUpdateMarketplace(mp.id, 'name', e.target.value)}
                              placeholder="Name"
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              compact
                              value={mp.feePercent}
                              onChange={e => handleUpdateMarketplace(mp.id, 'feePercent', Math.max(0, parseFloat(e.target.value) || 0))}
                              placeholder="%"
                              className="text-right"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              compact
                              value={mp.fixedFee}
                              onChange={e => handleUpdateMarketplace(mp.id, 'fixedFee', Math.max(0, parseFloat(e.target.value) || 0))}
                              placeholder="Fixed"
                              className="text-right"
                            />
                            <Button
                              variant="ghost"
                              btnSize="sm"
                              onClick={() => setEditingMarketplaceId(null)}
                              className="text-green-400 hover:text-green-300"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-white">{mp.name}</span>
                            <span className="text-xs text-slate-400">{mp.feePercent}% + {currencySymbol}{mp.fixedFee.toFixed(2)}</span>
                            <Button
                              variant="ghost"
                              btnSize="sm"
                              onClick={() => setEditingMarketplaceId(mp.id)}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </Button>
                            <Button
                              variant="danger"
                              btnSize="sm"
                              onClick={() => handleDeleteMarketplace(mp.id)}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new marketplace — grid template keeps name wide and numerics narrow */}
                <div className="grid grid-cols-[1fr_4rem_4rem_auto] gap-2">
                  <Input
                    type="text"
                    placeholder="Marketplace name"
                    value={newMarketplaceName}
                    onChange={e => setNewMarketplaceName(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    compact
                    placeholder="%"
                    value={newMarketplacePercent}
                    onChange={e => setNewMarketplacePercent(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    compact
                    placeholder={currencySymbol}
                    value={newMarketplaceFixed}
                    onChange={e => setNewMarketplaceFixed(e.target.value)}
                  />
                  <Button
                    onClick={handleAddMarketplace}
                    disabled={!newMarketplaceName.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Reset to defaults */}
              <div className="pt-4 border-t border-slate-700">
                <Button
                  variant="ghost"
                  btnSize="sm"
                  onClick={onResetMarketplaceFees}
                  className="text-slate-400 hover:text-slate-200"
                >
                  Reset all marketplace fees to defaults
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

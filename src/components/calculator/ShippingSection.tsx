import { useMemo } from 'react';
import type { ManualCostLine, Material, MaterialUsage, ShippingConfig, ShippingMethodType, MarketplaceType, Currency } from '../../types';
import { Button, Input, RemoveButton, Select, InfoTooltip } from '../ui';
import { kmToMiles, milesToKm, type DistanceUnit } from '../../utils/currency';
import type { MaterialRow } from '../../hooks/useCostForm';
import type { UseCostDerivedValuesResult } from '../../hooks/useCostDerivedValues';
import type { CalculatorFieldIds } from './fieldIds';

// Derived-values subset this section reads — Pick<> keeps the field names
// identical to useCostDerivedValues' return shape so the orchestrator can
// pass the hook's result object through directly (D-11: still just wiring,
// no new business math computed here).
type ShippingDerived = Pick<UseCostDerivedValuesResult, 'shippingCost' | 'packagingCost' | 'totalShippingCost' | 'materialsInProfile' | 'marketplaceFee'>;

interface ShippingSectionProps {
  shippingMethod: ShippingMethodType;
  onShippingMethodChange: (method: ShippingMethodType) => void;
  shippingDistanceKm: number;
  onShippingDistanceKmChange: (km: number) => void;
  shippingOverrideCost: number | null;
  onShippingOverrideCostChange: (cost: number | null) => void;
  derived: ShippingDerived;
  shippingConfig: ShippingConfig;
  distanceUnit: DistanceUnit;
  currencySymbol: string;
  packagingMaterials: MaterialRow[];
  consumables: Material[];
  onAddPackagingMaterial: () => void;
  onUpdatePackagingMaterial: (index: number, field: keyof MaterialUsage, value: string | number) => void;
  onRemovePackagingMaterial: (index: number) => void;
  // Phase 47.1 (MC-02, D-01): manual one-off packaging lines (name + cost, no library
  // asset). Rows are keyed/edited by persisted line.id, never by array index.
  manualPackaging: ManualCostLine[];
  onAddManualPackaging: () => void;
  onUpdateManualPackaging: (id: string, patch: Partial<Pick<ManualCostLine, 'name' | 'cost'>>) => void;
  onRemoveManualPackaging: (id: string) => void;
  marketplace: MarketplaceType;
  onMarketplaceChange: (marketplace: MarketplaceType) => void;
  sellingPrice: number;
  userCurrency: Currency;
  ids: CalculatorFieldIds;
}

/**
 * Shipping method/distance/cost + packaging materials + marketplace select.
 * Per A1, availableShippingMethods/availableMarketplaces are computed LOCALLY
 * here from userCurrency/shippingConfig.customCarriers — not routed through
 * the hooks. Props-in, callbacks-out; no Dexie access, no business math (D-11).
 */
export function ShippingSection({
  shippingMethod,
  onShippingMethodChange,
  shippingDistanceKm,
  onShippingDistanceKmChange,
  shippingOverrideCost,
  onShippingOverrideCostChange,
  derived: { shippingCost, packagingCost, totalShippingCost, materialsInProfile, marketplaceFee },
  shippingConfig,
  distanceUnit,
  currencySymbol,
  packagingMaterials,
  consumables,
  onAddPackagingMaterial,
  onUpdatePackagingMaterial,
  onRemovePackagingMaterial,
  manualPackaging,
  onAddManualPackaging,
  onUpdateManualPackaging,
  onRemoveManualPackaging,
  marketplace,
  onMarketplaceChange,
  sellingPrice,
  userCurrency,
  ids,
}: ShippingSectionProps) {
  // Get available shipping methods based on currency (A1 — computed locally, not via hooks)
  const availableShippingMethods = useMemo(() => {
    const methods: { value: ShippingMethodType; label: string }[] = [];

    // Universal options - available for all currencies
    methods.push({ value: 'local_pickup', label: 'Local Pickup (Free)' });
    methods.push({ value: 'dropoff', label: 'Dropoff (Fuel Cost)' });

    // International carriers - available everywhere
    methods.push({ value: 'ups', label: 'UPS' });
    methods.push({ value: 'fedex', label: 'FedEx' });
    methods.push({ value: 'dhl', label: 'DHL' });

    // Region-specific carriers
    if (userCurrency === 'CAD') {
      methods.push({ value: 'canada_post', label: 'Canada Post' });
      methods.push({ value: 'purolator', label: 'Purolator' });
    }
    if (userCurrency === 'USD') {
      methods.push({ value: 'usps', label: 'USPS' });
    }
    if (userCurrency === 'GBP') {
      methods.push({ value: 'royal_mail', label: 'Royal Mail' });
    }
    if (userCurrency === 'AUD' || userCurrency === 'NZD') {
      methods.push({ value: 'australia_post', label: 'Australia Post' });
    }

    // Add custom carriers from shipping config
    if (shippingConfig.customCarriers && shippingConfig.customCarriers.length > 0) {
      shippingConfig.customCarriers.forEach(carrier => {
        methods.push({ value: carrier.id, label: carrier.name });
      });
    }

    return methods;
  }, [userCurrency, shippingConfig.customCarriers]);

  // Get available marketplace options based on currency (A1 — computed locally, not via hooks)
  const availableMarketplaces = useMemo(() => {
    const options: { value: MarketplaceType; label: string; description: string }[] = [
      { value: 'none', label: 'Direct Sale', description: 'No marketplace fees' },
    ];

    if (userCurrency === 'CAD') {
      options.push({ value: 'facebook_local', label: 'FB Marketplace (Local)', description: 'Free for local pickup' });
      options.push({ value: 'facebook_shipped', label: 'FB Marketplace (Shipped)', description: '10% + 2.9% processing' });
      options.push({ value: 'kijiji', label: 'Kijiji', description: 'Free basic listing' });
    } else {
      options.push({ value: 'facebook_local', label: 'FB Marketplace (Local)', description: 'Free for local pickup' });
      options.push({ value: 'facebook_shipped', label: 'FB Marketplace (Shipped)', description: '10% + 2.9% processing' });
    }

    options.push({ value: 'etsy', label: 'Etsy', description: '6.5% + 3% + 0.45 fees' });
    options.push({ value: 'etsy_offsite_ad', label: 'Etsy (Offsite Ad)', description: '+ 15% offsite ad fee' });

    return options;
  }, [userCurrency]);

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4">Shipping</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
        <div>
          <label htmlFor={ids.shippingMethod} className="block text-xs text-slate-400 mb-1">Shipping Method</label>
          <Select
            id={ids.shippingMethod}
            value={shippingMethod}
            onChange={e => {
              onShippingMethodChange(e.target.value as ShippingMethodType);
              onShippingOverrideCostChange(null); // Reset override when method changes
            }}
          >
            {availableShippingMethods.map(method => (
              <option key={method.value} value={method.value}>{method.label}</option>
            ))}
          </Select>
        </div>

        {shippingMethod === 'dropoff' && (
          <div>
            <label htmlFor={ids.shippingDistance} className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <span>Distance ({distanceUnit})</span>
              <InfoTooltip text="Round-trip distance" />
            </label>
            <Input
              id={ids.shippingDistance}
              type="number"
              compact
              value={distanceUnit === 'mi' ? (shippingDistanceKm > 0 ? kmToMiles(shippingDistanceKm).toFixed(1) : '') : (shippingDistanceKm || '')}
              onChange={e => {
                const inputVal = parseFloat(e.target.value) || 0;
                // Convert miles to km for internal storage if using miles
                onShippingDistanceKmChange(distanceUnit === 'mi' ? milesToKm(inputVal) : inputVal);
              }}
              max={distanceUnit === 'mi' ? kmToMiles(shippingConfig.maxDeliveryRadiusKm) : shippingConfig.maxDeliveryRadiusKm}
              placeholder={`Max ${distanceUnit === 'mi' ? kmToMiles(shippingConfig.maxDeliveryRadiusKm).toFixed(0) : shippingConfig.maxDeliveryRadiusKm}${distanceUnit}`}
            />
            {shippingDistanceKm > shippingConfig.maxDeliveryRadiusKm && (
              <p className="text-xs text-red-400 mt-1">Exceeds max delivery radius!</p>
            )}
          </div>
        )}

        <div>
          <label htmlFor={ids.carrierCost} className="block text-xs text-slate-400 mb-1">Carrier Cost ({currencySymbol})</label>
          <Input
            id={ids.carrierCost}
            type="number"
            step="0.01"
            compact
            value={shippingOverrideCost !== null ? shippingOverrideCost : shippingCost}
            onChange={e => onShippingOverrideCostChange(parseFloat(e.target.value) || 0)}
            placeholder={shippingCost.toFixed(2)}
          />
          {shippingOverrideCost !== null && (
            <Button
              variant="ghost"
              btnSize="sm"
              onClick={() => onShippingOverrideCostChange(null)}
              className="mt-1 text-blue-400 hover:text-blue-300 text-xs"
            >
              Reset to default
            </Button>
          )}
        </div>
      </div>

      {/* Packaging Materials */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium text-white">
              <span>Packaging Materials</span>
            </h3>
            <p className="text-xs text-slate-500">Boxes, bubble wrap, tape, etc.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              btnSize="sm"
              onClick={onAddPackagingMaterial}
              disabled={consumables.length === 0}
              className="text-xs"
            >
              + Add Packaging
            </Button>
            {/* Phase 47.1: never disabled, so it works with an empty library. */}
            <Button variant="secondary" btnSize="sm" onClick={onAddManualPackaging} className="text-xs">
              + One-off cost
            </Button>
            <InfoTooltip text="Add a one-time packaging cost that isn't in your asset library. The full amount is added to this job's shipping cost." />
          </div>
        </div>

        {packagingMaterials.length === 0 && manualPackaging.length === 0 ? (
          <p className="text-slate-500 text-xs">No packaging materials added.</p>
        ) : (
          <div className="space-y-2">
            {packagingMaterials.map((usage, index) => {
              const material = materialsInProfile.find(m => m.id === usage.materialId);
              return (
                <div key={usage.uid} className="flex items-center gap-3 bg-slate-700/50 p-2 rounded-lg">
                  <Select
                    value={usage.materialId}
                    onChange={e => onUpdatePackagingMaterial(index, 'materialId', e.target.value)}
                    className="flex-1"
                  >
                    {consumables.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={usage.quantity}
                      onChange={e => onUpdatePackagingMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
                      inputSize="sm"
                      className="w-16 text-right"
                    />
                    <span className="text-slate-400 text-xs w-8">{material?.unit || ''}</span>
                  </div>
                  <span className="text-slate-300 text-sm font-mono w-14 text-right">
                    {currencySymbol}{material ? (usage.quantity * (material.costPerUnit ?? 0)).toFixed(2) : '0.00'}
                  </span>
                  <RemoveButton
                    label={material?.name ?? 'material'}
                    onClick={() => onRemovePackagingMaterial(index)}
                  />
                </div>
              );
            })}
            {manualPackaging.map(line => (
              <div key={line.id} className="flex items-center gap-3 bg-slate-700/50 p-2 rounded-lg">
                <span className="text-xs text-slate-400 bg-slate-600/60 rounded px-2 py-0.5">One-off</span>
                <Input
                  type="text"
                  inputSize="sm"
                  aria-label="One-off packaging name"
                  placeholder="Gift wrap"
                  value={line.name}
                  onChange={e => onUpdateManualPackaging(line.id, { name: e.target.value })}
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">{currencySymbol}</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputSize="sm"
                    compact
                    aria-label="One-off packaging cost"
                    placeholder="0.00"
                    value={line.cost || ''}
                    onChange={e => onUpdateManualPackaging(line.id, { cost: Math.max(parseFloat(e.target.value) || 0, 0) })}
                    className="text-right"
                  />
                </div>
                <RemoveButton
                  label={line.name || 'one-off packaging cost'}
                  onClick={() => onRemoveManualPackaging(line.id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Total Shipping Summary */}
        {(shippingCost > 0 || packagingCost > 0) && (
          <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Carrier/Delivery:</span>
              <span>{currencySymbol}{shippingCost.toFixed(2)}</span>
            </div>
            {packagingCost > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Packaging:</span>
                <span>{currencySymbol}{packagingCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-medium text-white mt-1 pt-1 border-t border-slate-600">
              <span>Total Shipping:</span>
              <span>{currencySymbol}{totalShippingCost.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Marketplace Selection */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="mb-3">
          <h3 className="text-sm font-medium text-white">Marketplace</h3>
          <p className="text-xs text-slate-500">Platform fees deducted from your revenue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-3">
          <div>
            <label htmlFor={ids.sellingPlatform} className="block text-xs text-slate-400 mb-1">Selling Platform</label>
            <Select
              id={ids.sellingPlatform}
              value={marketplace}
              onChange={e => onMarketplaceChange(e.target.value as MarketplaceType)}
            >
              {availableMarketplaces.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              {availableMarketplaces.find(m => m.value === marketplace)?.description}
            </p>
          </div>

          {marketplaceFee > 0 && (
            <div className="flex items-center">
              <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg w-full">
                <div className="text-xs text-orange-400">Marketplace Fee</div>
                <div className="text-lg font-semibold text-orange-400">{currencySymbol}{marketplaceFee.toFixed(2)}</div>
                <div className="text-xs text-slate-500">Deducted from {currencySymbol}{sellingPrice.toFixed(2)} sale</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

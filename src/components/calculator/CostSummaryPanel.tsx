import { memo } from 'react';
import type { CostBreakdown, ShippingMethodType, MarketplaceType, Currency } from '../../types';
import { CollapsibleSection, InfoTooltip } from '../ui';
import { NewBadge } from '../NewBadge';
import { tooltipForSource, labelForSource } from '../../utils/taxResolution';
import { etsyChecklist, policySummaryAsOf, policyLink } from '../../data/etsyToS';
import type { TaxRateSource } from '../../utils/taxResolution';

interface FixedCosts {
  depreciation: number;
  nozzleWear: number;
  modelCost: number;
  total: number;
}

interface BreakEvenInfo {
  costPerUnit: number;
  profitPerUnit: number;
  breakEvenCopies: number;
  totalInvestmentToBreakEven: number;
}

interface TaxInfo {
  ratePercent: number;
  taxAmount: number;
}

interface CostSummaryPanelProps {
  currencySymbol: string;
  userCurrency: Currency;
  costs: CostBreakdown;
  trueCost: number;
  sellingPrice: number;
  shippingCost: number;
  shippingMethod: ShippingMethodType;
  packagingCost: number;
  totalShippingCost: number;
  modelCost: number;
  modelCostPerUnit: boolean;
  prepTimeMinutes: number;
  postProcessingMinutes: number;
  laborHourlyRate: number;
  failureRate: number;
  fixedCosts: FixedCosts;
  breakEvenInfo: BreakEvenInfo;
  printTimeHours: number;
  taxSource: TaxRateSource;
  tax: TaxInfo;
  marketplaceFee: number;
  marketplace: MarketplaceType;
  etsyChecks: Record<string, boolean>;
  onEtsyChecksChange: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
}

/**
 * Cost breakdown + fixed costs + break-even widget + Etsy compliance checklist
 * (conditional on marketplace === 'etsy', D-22). Renders derived values via
 * the currencySymbol prop passed down from the orchestrator (D-03 formatting
 * pipeline — never recomputed here). Props-in, callbacks-out; no Dexie
 * access, no business math (D-11).
 */
export const CostSummaryPanel = memo(function CostSummaryPanel({
  currencySymbol,
  costs,
  trueCost,
  sellingPrice,
  shippingCost,
  shippingMethod,
  packagingCost,
  totalShippingCost,
  modelCost,
  modelCostPerUnit,
  prepTimeMinutes,
  postProcessingMinutes,
  laborHourlyRate,
  failureRate,
  fixedCosts,
  breakEvenInfo,
  printTimeHours,
  taxSource,
  tax,
  marketplaceFee,
  marketplace,
  etsyChecks,
  onEtsyChecksChange,
  userCurrency,
}: CostSummaryPanelProps) {
  return (
    <>
      {/* Cost Breakdown */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Cost Breakdown</h2>

        <div className="space-y-2 text-sm">
          {/* Per-Unit Costs (Consumables) */}
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Per-Unit Costs (Consumables)</div>
          <div className="flex justify-between text-slate-300">
            <span>Filament</span>
            <span className="font-mono">{currencySymbol}{costs.filament.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Electricity</span>
            <span className="font-mono">{currencySymbol}{costs.electricity.toFixed(2)}</span>
          </div>
          {costs.materials > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>Post-Processing Materials</span>
              <span className="font-mono">{currencySymbol}{costs.materials.toFixed(2)}</span>
            </div>
          )}
          {costs.labor > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>Labor ({prepTimeMinutes + postProcessingMinutes} min @ {currencySymbol}{laborHourlyRate}/hr)</span>
              <span className="font-mono">{currencySymbol}{costs.labor.toFixed(2)}</span>
            </div>
          )}
          {shippingCost > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>Shipping ({shippingMethod.replace('_', ' ')})</span>
              <span className="font-mono">{currencySymbol}{shippingCost.toFixed(2)}</span>
            </div>
          )}
          {packagingCost > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>Packaging Materials</span>
              <span className="font-mono">{currencySymbol}{packagingCost.toFixed(2)}</span>
            </div>
          )}
          {modelCostPerUnit && modelCost > 0 && (
            <div className="flex justify-between text-purple-400">
              <span>Model License (per unit)</span>
              <span className="font-mono">{currencySymbol}{modelCost.toFixed(2)}</span>
            </div>
          )}

          <div className="border-t border-slate-700 pt-2 mt-2">
            <div className="flex justify-between text-slate-300">
              <span>Subtotal</span>
              <span className="font-mono">{currencySymbol}{(costs.subtotal + totalShippingCost).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-yellow-400">
              <span>+ Failure Adjustment ({failureRate}%)</span>
              <span className="font-mono">+{currencySymbol}{(costs.failureAdjusted - costs.subtotal).toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-slate-600 pt-3 mt-3">
            <div className="flex justify-between text-white text-lg font-semibold">
              <span>Cost Per Unit</span>
              <span className="font-mono">{currencySymbol}{trueCost.toFixed(2)}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              This is what you spend each time you print this item
            </div>
          </div>

          {/* Tax row (TAX-04 — hides at 0%; total uses sellingPrice + taxAmount per TAX-05).
              Also requires sellingPrice > 0 so we don't render "Tax (20%) — $0.00 / Total — $0.00"
              when the user has set a rate but not yet a price. */}
          {tax.ratePercent > 0 && sellingPrice > 0 && (
            <div className="border-t border-slate-700 pt-2 mt-2">
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span>Tax ({tax.ratePercent.toFixed(1)}%)</span>
                  <span className="text-xs text-slate-500">· {labelForSource(taxSource)}</span>
                  <InfoTooltip text={tooltipForSource(taxSource, userCurrency)} />
                </span>
                <span className="font-mono">{currencySymbol}{tax.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white font-semibold mt-1">
                <span>Total (with Tax)</span>
                <span className="font-mono">{currencySymbol}{(sellingPrice + tax.taxAmount).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Marketplace Fee Note */}
          {marketplaceFee > 0 && sellingPrice > 0 && (
            <div className="mt-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-orange-400">Marketplace Fee ({marketplace.replace('_', ' ')})</div>
                  <div className="text-xs text-slate-500">Deducted from your sale revenue, not added to cost</div>
                </div>
                <div className="text-lg font-semibold text-orange-400">-{currencySymbol}{marketplaceFee.toFixed(2)}</div>
              </div>
              <div className="text-xs text-slate-400 mt-2">
                You receive: {currencySymbol}{(sellingPrice - marketplaceFee).toFixed(2)} | Net profit: {currencySymbol}{(sellingPrice - marketplaceFee - trueCost).toFixed(2)}
              </div>
            </div>
          )}

          {/* Fixed Costs Section */}
          {fixedCosts.total > 0 && (
            <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">Fixed Costs (Recovered Through Sales)</div>

              {fixedCosts.depreciation > 0 && (
                <div className="flex justify-between text-slate-300 mb-2">
                  <span>Printer Depreciation ({printTimeHours}h print)</span>
                  <span className="font-mono">{currencySymbol}{fixedCosts.depreciation.toFixed(2)}</span>
                </div>
              )}
              {fixedCosts.nozzleWear > 0 && (
                <div className="flex justify-between text-slate-300 mb-2">
                  <span>Nozzle Wear</span>
                  <span className="font-mono">{currencySymbol}{fixedCosts.nozzleWear.toFixed(2)}</span>
                </div>
              )}
              {modelCost > 0 && !modelCostPerUnit && (
                <div className="flex justify-between text-slate-300 mb-2">
                  <span>Model/STL Cost (one-time)</span>
                  <span className="font-mono">{currencySymbol}{modelCost.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-white font-semibold pt-2 border-t border-slate-600">
                <span>Total Fixed Costs</span>
                <span className="font-mono">{currencySymbol}{fixedCosts.total.toFixed(2)}</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                These costs are spread across all units sold. The more you sell, the less each unit carries.
              </div>
            </div>
          )}

          {/* Break-even Banner */}
          {trueCost > 0 && sellingPrice > 0 && fixedCosts.total > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg border border-blue-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-blue-300 font-medium">Break-even Units</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Sell this many to recover {currencySymbol}{fixedCosts.total.toFixed(2)} in fixed costs
                  </div>
                </div>
                <div className="text-4xl font-bold text-blue-400">
                  {breakEvenInfo.breakEvenCopies === Infinity ? '∞' : breakEvenInfo.breakEvenCopies}
                </div>
              </div>
              {breakEvenInfo.profitPerUnit > 0 && (
                <div className="text-xs text-slate-400 mt-2">
                  {currencySymbol}{breakEvenInfo.profitPerUnit.toFixed(2)} profit per unit at {currencySymbol}{sellingPrice.toFixed(2)} selling price
                </div>
              )}
              {breakEvenInfo.profitPerUnit <= 0 && (
                <div className="text-xs text-red-400 mt-2">
                  Warning: Selling price is below cost. You lose {currencySymbol}{Math.abs(breakEvenInfo.profitPerUnit).toFixed(2)} per unit.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/*
        Etsy compliance helper — Phase 14 ETSY-01, ETSY-02 (revised on 2026-05-22).
        Conditional on marketplace === 'etsy' (D-22): the section is irrelevant
        when the user isn't selling on Etsy, so we hide it instead of always showing
        a checklist for a marketplace they don't use.
      */}
      {marketplace === 'etsy' && (
      <CollapsibleSection
        title="Selling on Etsy?"
        badge={<NewBadge feature="etsy-helper" className="absolute -top-1 -right-1" />}
      >
        {/* Disclaimer at top — verbatim wording locked by D-17 / ROADMAP success criterion #4 */}
        <div className="bg-slate-700/50 border border-yellow-500/30 text-yellow-100/90 rounded p-3 text-sm mb-4">
          Etsy's policies change — this is a reminder, not legal advice.
        </div>

        {/* 5-item checklist; raw checkbox elements require the `allow-raw-html` comment per lint guard (PATTERNS Gotcha) */}
        <div className="space-y-1">
          {etsyChecklist.map(item => (
            <label key={item.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-700/30 cursor-pointer">
              {/* allow-raw-html: per-item checklist toggle; no Checkbox primitive exists, matches BambuImport.tsx:209 precedent */}
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 accent-blue-500 cursor-pointer"
                checked={!!etsyChecks?.[item.id]}
                onChange={e => onEtsyChecksChange(prev => ({ ...prev, [item.id]: e.target.checked }))}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{item.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{item.body}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Date + live link rendered inline below checklist — D-17 */}
        <div className="mt-4 text-xs text-slate-500">
          Verified against Etsy policy as of {policySummaryAsOf} —{' '}
          <a
            href={policyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            etsy.com/legal/creativity/
          </a>
        </div>
      </CollapsibleSection>
      )}
    </>
  );
});

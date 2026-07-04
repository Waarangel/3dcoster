import { memo } from 'react';
import { Input } from '../ui';
import type { PricingAction } from '../../hooks/useCostDerivedValues';

interface PricingSectionProps {
  currencySymbol: string;
  trueCost: number;
  sellingPrice: number;
  targetProfit: number;
  profitMarginPercent: number;
  marketplaceFee: number;
  authorMinPrice: number;
  taxRateOverride: number | undefined;
  onTaxRateOverrideChange: (value: number | undefined) => void;
  inheritedTaxRate: number;
  dispatchPricing: (action: PricingAction) => void;
  profitMarginId: string;
  targetProfitId: string;
  sellingPriceId: string;
  taxRateId: string;
}

/**
 * Interlinked price/margin/profit fields + live totals + tax rate. Field
 * onChange handlers dispatch reducer actions (EDIT_MARGIN/EDIT_PROFIT/
 * EDIT_PRICE) from useCostDerivedValues' pricingReducer — event-driven, no
 * local pricing state. Props-in, callbacks-out; no Dexie access, no business
 * math (D-11).
 */
export const PricingSection = memo(function PricingSection({
  currencySymbol,
  trueCost,
  sellingPrice,
  targetProfit,
  profitMarginPercent,
  marketplaceFee,
  authorMinPrice,
  taxRateOverride,
  onTaxRateOverrideChange,
  inheritedTaxRate,
  dispatchPricing,
  profitMarginId,
  targetProfitId,
  sellingPriceId,
  taxRateId,
}: PricingSectionProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-4">Set Financial Targets</h2>
      <p className="text-slate-400 text-sm mb-4">Set targets and keep track of profitability throughout your project</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4">
        <div>
          <label htmlFor={profitMarginId} className="block text-sm font-medium text-white mb-1">Profit Margin</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">%</span>
            <Input
              id={profitMarginId}
              type="number"
              value={profitMarginPercent || ''}
              onChange={e => {
                dispatchPricing({ type: 'EDIT_MARGIN', value: parseFloat(e.target.value) || 0 });
              }}
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <label htmlFor={targetProfitId} className="block text-sm font-medium text-white mb-1">Target Profit</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">{currencySymbol}</span>
            <Input
              id={targetProfitId}
              type="number"
              step="0.01"
              value={targetProfit || ''}
              onChange={e => {
                dispatchPricing({ type: 'EDIT_PROFIT', value: parseFloat(e.target.value) || 0 });
              }}
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <label htmlFor={sellingPriceId} className="block text-sm font-medium text-white mb-1">Selling Price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">{currencySymbol}</span>
            <Input
              id={sellingPriceId}
              type="number"
              step="0.01"
              value={sellingPrice || ''}
              onChange={e => {
                dispatchPricing({ type: 'EDIT_PRICE', value: parseFloat(e.target.value) || 0 });
              }}
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <label htmlFor={taxRateId} className="block text-sm font-medium text-white mb-1">Tax Rate</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">%</span>
            <Input
              id={taxRateId}
              type="number"
              min="0"
              max="99.9"
              step="0.1"
              className="pl-8"
              value={taxRateOverride ?? ''}
              placeholder={inheritedTaxRate > 0 ? String(inheritedTaxRate) : 'e.g., 20'}
              onChange={e => {
                const v = e.target.value;
                if (v === '') {
                  onTaxRateOverrideChange(undefined);
                } else {
                  const parsed = parseFloat(v);
                  if (Number.isFinite(parsed)) {
                    onTaxRateOverrideChange(Math.min(Math.max(parsed, 0), 99.9));
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {trueCost > 0 && sellingPrice > 0 && (
        <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{currencySymbol}{trueCost.toFixed(2)}</div>
              <div className="text-xs text-slate-400">True Cost</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">{currencySymbol}{sellingPrice.toFixed(2)}</div>
              <div className="text-xs text-slate-400">Sell Price</div>
            </div>
            {marketplaceFee > 0 && (
              <div>
                <div className="text-2xl font-bold text-orange-400">-{currencySymbol}{marketplaceFee.toFixed(2)}</div>
                <div className="text-xs text-slate-400">Platform Fee</div>
              </div>
            )}
            <div>
              {/* targetProfit / profitMarginPercent are now NET of the platform
                  fee (interlink derives them net), so render them directly —
                  re-subtracting the fee here would double-count it. */}
              <div className={`text-2xl font-bold ${targetProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {currencySymbol}{targetProfit.toFixed(2)}
              </div>
              <div className="text-xs text-slate-400">Net Profit</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {profitMarginPercent.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-400">Net Margin</div>
            </div>
          </div>
          {marketplaceFee > 0 && (
            <p className="text-xs text-orange-400 text-center mt-3">
              Marketplace fees reduce your profit by {currencySymbol}{marketplaceFee.toFixed(2)} ({((marketplaceFee / sellingPrice) * 100).toFixed(1)}% of sale)
            </p>
          )}
          {authorMinPrice > 0 && sellingPrice < authorMinPrice && (
            <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-sm text-red-400 text-center font-medium">
                Warning: Your selling price ({currencySymbol}{sellingPrice.toFixed(2)}) is below the author's minimum price ({currencySymbol}{authorMinPrice.toFixed(2)})
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

import type { Currency, MarketplaceFees, MarketplaceType } from '../types';
import { convert, type FxRateTable } from './fxConvert';

// ---------------------------------------------------------------------------
// Pure marketplace-fee math (cost HIGH fix, v1.9 audit).
//
// The fee config (defaultMarketplaceFees in useDatabase.ts) stores PERCENTAGE
// fields as whole-number percents (e.g. 10 = 10%) and FIXED fields as USD
// dollar amounts (e.g. etsyPaymentFixed = 0.25 USD). Percentages are
// currency-agnostic; fixed-dollar fees are NOT — they must be converted from
// USD into the user's currency before being added to a selling price that is
// already in the user's currency. Skipping the conversion mis-prices every
// non-USD seller (a JPY Etsy seller would pay ¥0.45 instead of ~¥70).
//
// Decomposing the fee into a percentage rate + a fixed amount (both in the
// user's currency) is what lets the pricing interlink solve the circular
// "price depends on fee, fee depends on price" relationship in closed form
// (see CostCalculator's net-margin derivation).
// ---------------------------------------------------------------------------

export interface MarketplaceFeeParts {
  /**
   * Combined percentage fee as a FRACTION of the selling price (e.g. 0.095 for
   * 9.5%). Currency-agnostic. Note: when the platform applies a floor (Facebook
   * shipped's $0.80 min), that floor is NOT captured here — see `pctFees` caveat
   * in computeMarketplaceFee. For the closed-form net-margin solve we treat the
   * floor as inactive (the common case for any realistically-priced item).
   */
  pctFees: number;
  /** Fixed per-sale fee, already converted into the user's currency. */
  fixedFees: number;
  /** The total fee for the given selling price, in the user's currency. */
  total: number;
}

// Convert a USD-denominated fixed fee into the user's currency. Falls back to
// the raw USD number when no rate is available (offline before first fetch) so
// the calc never breaks — mirrors CostCalculator.convertToProfile's contract.
function fixedInProfile(usdFee: number, userCurrency: Currency, fxTable: FxRateTable | null): number {
  return convert(usdFee, 'USD', userCurrency, fxTable) ?? usdFee;
}

/**
 * Compute the marketplace fee for a sale, FX-converting the fixed-dollar fee
 * constants from USD into the user's currency. Percentage fees are left as-is.
 *
 * Returns the fee `total` plus a `{ pctFees, fixedFees }` decomposition (both in
 * the user's currency) for the pricing interlink's closed-form net-margin solve.
 *
 * Examples:
 *   // USD seller, Etsy, $20 sale, default fees → 20*0.065 + 20*0.03 + 0.25 + 0.20 = 2.35
 *   computeMarketplaceFee({ sellingPrice: 20, marketplace: 'etsy', fees, userCurrency: 'USD', fxTable })
 *     → { pctFees: 0.095, fixedFees: 0.45, total: 2.35 }
 *
 *   // JPY seller, Etsy, ¥3000 sale, 1 USD = 150 JPY → fixed 0.45 USD = ¥67.5
 *   computeMarketplaceFee({ sellingPrice: 3000, marketplace: 'etsy', fees, userCurrency: 'JPY', fxTable })
 *     → { pctFees: 0.095, fixedFees: 67.5, total: 3000*0.095 + 67.5 = 352.5 }
 *
 *   // Direct sale / local pickup → no fee
 *   computeMarketplaceFee({ sellingPrice: 50, marketplace: 'none', ... })
 *     → { pctFees: 0, fixedFees: 0, total: 0 }
 *
 * Returns: MarketplaceFeeParts { pctFees, fixedFees, total }
 */
export function computeMarketplaceFee(params: {
  sellingPrice: number;
  marketplace: MarketplaceType;
  fees: MarketplaceFees;
  userCurrency: Currency;
  fxTable: FxRateTable | null;
}): MarketplaceFeeParts {
  const { sellingPrice, marketplace, fees, userCurrency, fxTable } = params;

  // No-fee platforms: byte-identical to a zero fee for any price (incl. <= 0).
  switch (marketplace) {
    case 'none':
    case 'facebook_local':
    case 'kijiji':
      return { pctFees: 0, fixedFees: 0, total: 0 };
  }

  const conv = (usd: number) => fixedInProfile(usd, userCurrency, fxTable);

  switch (marketplace) {
    case 'facebook_shipped': {
      // Selling fee has a floor (facebookMinFee, USD) + percentage; plus a
      // pure-percentage processing fee. The floor is a fixed-dollar value so it
      // converts too. For pctFees we report the combined percentage rate and let
      // the floor live in fixedFees ONLY when it is the active term — but because
      // whether the floor binds depends on price (circular), the closed-form
      // solve uses the percentage path and the floor is re-checked at render via
      // `total`. In practice the floor only binds on sub-~$8 sales.
      const pct = (fees.facebookShippedPercent + fees.facebookProcessingPercent) / 100;
      const minFee = conv(fees.facebookMinFee);
      if (sellingPrice <= 0) {
        return { pctFees: pct, fixedFees: 0, total: 0 };
      }
      const sellingFee = Math.max(minFee, sellingPrice * (fees.facebookShippedPercent / 100));
      const processingFee = sellingPrice * (fees.facebookProcessingPercent / 100);
      const total = sellingFee + processingFee;
      // fixedFees reflects the floor only when it is the binding term; otherwise 0.
      const floorBinds = minFee > sellingPrice * (fees.facebookShippedPercent / 100);
      return {
        pctFees: floorBinds ? fees.facebookProcessingPercent / 100 : pct,
        fixedFees: floorBinds ? minFee : 0,
        total,
      };
    }

    case 'etsy': {
      const pct = (fees.etsyTransactionPercent + fees.etsyPaymentPercent) / 100;
      const fixed = conv(fees.etsyPaymentFixed) + conv(fees.etsyListingFee);
      const total = sellingPrice > 0 ? sellingPrice * pct + fixed : 0;
      return { pctFees: pct, fixedFees: fixed, total };
    }

    case 'etsy_offsite_ad': {
      const pct =
        (fees.etsyTransactionPercent + fees.etsyPaymentPercent + fees.etsyOffsiteAdPercent) / 100;
      const fixed = conv(fees.etsyPaymentFixed) + conv(fees.etsyListingFee);
      const total = sellingPrice > 0 ? sellingPrice * pct + fixed : 0;
      return { pctFees: pct, fixedFees: fixed, total };
    }

    default:
      return { pctFees: 0, fixedFees: 0, total: 0 };
  }
}

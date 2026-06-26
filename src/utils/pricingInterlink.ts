// ---------------------------------------------------------------------------
// Pure pricing-interlink math (cost MEDIUM fix, v1.9 audit — DECISION: net).
//
// The Calculator's three pricing fields (profit margin %, target profit $,
// selling price $) are interlinked: editing one re-derives the other two from
// `trueCost`. Per the v1.9 decision, the QUOTED margin/profit are now NET of
// marketplace fees so the readout matches the "Net Profit"/"Net Margin" framing.
//
// The fee is circular with price — fee = fixedFees + price * pctFees — but every
// branch has a closed form:
//
//   target NET margin m:  price = (trueCost + fixedFees) / (1 - pctFees - m/100)
//   target NET profit  p:  price = (trueCost + fixedFees + p) / (1 - pctFees)
//   user-entered price  P:  netProfit = P - trueCost - (fixedFees + P*pctFees)
//                           netMargin = netProfit / P
//
// CRITICAL no-marketplace invariant: when no platform is selected
// (pctFees = 0, fixedFees = 0) every formula reduces EXACTLY to the prior gross
// math:
//   margin: price = trueCost / (1 - m/100)
//   profit: price = trueCost + p
//   price : profit = price - trueCost ; margin = profit/price
// so the no-marketplace path is byte-identical to before this change.
//
// These helpers are pure (no React) so the derivations are unit-testable in
// isolation. The component rounds the results to the same precision the prior
// inline math used (price/profit → 2dp, margin → 1dp).
// ---------------------------------------------------------------------------

export interface FeeShape {
  /** Combined percentage fee as a fraction of price (e.g. 0.095 for 9.5%). */
  pctFees: number;
  /** Fixed per-sale fee in the user's currency. */
  fixedFees: number;
}

const NO_FEE: FeeShape = { pctFees: 0, fixedFees: 0 };

// Margin is clamped below 100% (prevents div-by-zero) exactly as the prior
// inline guard did. With fees, the effective denominator is (1 - pctFees - m/100);
// we additionally floor it at a tiny epsilon so a pathological pct+margin combo
// can't produce a negative/zero denominator (which would flip the price sign).
const MARGIN_CAP = 99.9;
const DENOM_EPSILON = 1e-9;

/** Derive selling price + net profit from a target NET margin %. */
export function priceFromMargin(trueCost: number, marginPercent: number, fee: FeeShape = NO_FEE): { price: number; netProfit: number } {
  const clampedMargin = Math.min(marginPercent, MARGIN_CAP);
  const denom = Math.max(1 - fee.pctFees - clampedMargin / 100, DENOM_EPSILON);
  const price = (trueCost + fee.fixedFees) / denom;
  const netProfit = price - trueCost - (fee.fixedFees + price * fee.pctFees);
  return { price, netProfit };
}

/** Derive selling price + net margin % from a target NET profit. */
export function priceFromProfit(trueCost: number, targetNetProfit: number, fee: FeeShape = NO_FEE): { price: number; marginPercent: number } {
  const denom = Math.max(1 - fee.pctFees, DENOM_EPSILON);
  const price = (trueCost + fee.fixedFees + targetNetProfit) / denom;
  const netProfit = price - trueCost - (fee.fixedFees + price * fee.pctFees);
  const marginPercent = price > 0 ? (netProfit / price) * 100 : 0;
  return { price, marginPercent };
}

/** Derive net profit + net margin % from a user-entered selling price. */
export function marginFromPrice(trueCost: number, price: number, fee: FeeShape = NO_FEE): { netProfit: number; marginPercent: number } {
  const feeTotal = price > 0 ? fee.fixedFees + price * fee.pctFees : 0;
  const netProfit = price - trueCost - feeTotal;
  const marginPercent = price > 0 ? (netProfit / price) * 100 : 0;
  return { netProfit, marginPercent };
}

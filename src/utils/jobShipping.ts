import type { PrintJob, ShippingConfig } from '../types';

/**
 * Compute the effective shipping cost for a saved PrintJob.
 *
 * Mirrors CostCalculator's shippingCost memo: returns the override when set,
 * otherwise resolves from the job's shipping method against shippingConfig.
 * Dropoff is computed from fuel parameters and ceiled to the next cent so
 * float math (e.g. 6.354179…) doesn't leak into UI surfaces that display the
 * value.
 *
 * Used by PrintQuoteModal (pre-fill the Shipping cost field on Create Quote)
 * and is shape-compatible with CostCalculator's local memo for future
 * deduplication.
 */
export function computeJobShipping(
  job: Pick<PrintJob, 'shippingMethod' | 'shippingDistanceKm' | 'shippingOverrideCost'>,
  shippingConfig: ShippingConfig,
): number {
  if (job.shippingOverrideCost != null) return job.shippingOverrideCost;

  switch (job.shippingMethod) {
    case undefined:
    case 'local_pickup':
      return 0;
    case 'dropoff': {
      const roundTripKm = (job.shippingDistanceKm ?? 0) * 2;
      const litersUsed = (roundTripKm / 100) * shippingConfig.vehicleFuelEfficiency;
      return Math.ceil(litersUsed * shippingConfig.gasPricePerLiter * 100) / 100;
    }
    case 'ups': return shippingConfig.upsBaseCost;
    case 'fedex': return shippingConfig.fedexBaseCost;
    case 'dhl': return shippingConfig.dhlBaseCost;
    case 'purolator': return shippingConfig.purolatorBaseCost;
    case 'usps': return shippingConfig.uspsBaseCost;
    case 'royal_mail': return shippingConfig.royalMailBaseCost;
    case 'australia_post': return shippingConfig.australiaPostBaseCost;
    case 'canada_post': return shippingConfig.canadaPostBaseCost;
    default: {
      const customCarrier = shippingConfig.customCarriers?.find(c => c.id === job.shippingMethod);
      return customCarrier?.defaultCost ?? 0;
    }
  }
}

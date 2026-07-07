import { useCallback } from 'react';
import type { ElectricityConfig, TouBand } from '../types';
import { parseHHMM } from '../utils/touElectricity';

// Phase 39 TOU-01 (D-09). Max 3 named TOU bands beside the flat default rate.
// This hook is the read/write + validation boundary for ElectricityConfig.touBands —
// SettingsModal's band editor calls these setters instead of writing touBands
// directly, so the max-3 clamp and HH:MM validation live in exactly one place.
export const MAX_TOU_BANDS = 3;

interface UseTouTariffResult {
  /** The flat default $/kWh rate (ElectricityConfig.costPerKwh). */
  flatRate: number;
  /** Configured TOU bands (0-3), in ElectricityConfig.touBands order. */
  bands: TouBand[];
  /** Update the flat default rate. Non-finite input is ignored (no write). */
  setFlatRate: (rate: number) => void;
  /**
   * Insert a new band or update an existing one (matched by `id`). Rejects
   * (no-op) when: adding a 4th band beyond MAX_TOU_BANDS (D-09), the rate is
   * not finite, or either window fails strict HH:MM validation (parseHHMM).
   */
  upsertBand: (band: TouBand) => void;
  /** Remove a band by id. No-op if the id doesn't match any existing band. */
  removeBand: (id: string) => void;
}

function isValidBand(band: TouBand): boolean {
  return (
    Number.isFinite(band.ratePerKwh) &&
    parseHHMM(band.startTime) !== null &&
    parseHHMM(band.endTime) !== null
  );
}

/**
 * TOU tariff settings read/write + validation (Phase 39 TOU-01). Wraps the
 * existing ElectricityConfig read/write path (electricity + onElectricityChange)
 * — no new settings key is forked (per RESEARCH.md Open Question 2 decision).
 */
export function useTouTariff(
  electricity: ElectricityConfig,
  onElectricityChange: (config: ElectricityConfig) => void,
): UseTouTariffResult {
  const bands = electricity.touBands ?? [];

  const setFlatRate = useCallback(
    (rate: number) => {
      if (!Number.isFinite(rate)) return;
      onElectricityChange({ ...electricity, costPerKwh: rate });
    },
    [electricity, onElectricityChange]
  );

  const upsertBand = useCallback(
    (band: TouBand) => {
      if (!isValidBand(band)) return;
      const existingIdx = bands.findIndex(b => b.id === band.id);
      if (existingIdx === -1) {
        // Adding a new band — enforce the D-09 max-3 clamp.
        if (bands.length >= MAX_TOU_BANDS) return;
        onElectricityChange({ ...electricity, touBands: [...bands, band] });
        return;
      }
      const nextBands = bands.slice();
      nextBands[existingIdx] = band;
      onElectricityChange({ ...electricity, touBands: nextBands });
    },
    [bands, electricity, onElectricityChange]
  );

  const removeBand = useCallback(
    (id: string) => {
      const nextBands = bands.filter(b => b.id !== id);
      if (nextBands.length === bands.length) return; // no-op, id not found
      onElectricityChange({ ...electricity, touBands: nextBands });
    },
    [bands, electricity, onElectricityChange]
  );

  return {
    flatRate: electricity.costPerKwh,
    bands,
    setFlatRate,
    upsertBand,
    removeBand,
  };
}

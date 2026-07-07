import { useCallback } from 'react';
import type { ElectricityConfig, TouBand } from '../types';
import { bandsOverlap, parseHHMM } from '../utils/touElectricity';

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
   * (no write) when: adding a 4th band beyond MAX_TOU_BANDS (D-09), the rate
   * is not finite, either window fails strict HH:MM validation (parseHHMM),
   * or the band's window overlaps another configured band (WR-07 — overlap
   * would make electricity pricing silently first-match-wins by array order).
   * Returns a user-facing error message on rejection, null on success.
   */
  upsertBand: (band: TouBand) => string | null;
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
    (band: TouBand): string | null => {
      if (!isValidBand(band)) {
        return 'Enter a valid rate and HH:MM start/end times.';
      }
      // WR-07: reject a window that overlaps any OTHER configured band —
      // overlapping bands would price the shared minutes by whichever band
      // happens to sit first in the array, silently and permanently (the
      // resolved rate is snapshotted onto saved jobs).
      const clash = bands.find(b => b.id !== band.id && bandsOverlap(b, band));
      if (clash) {
        return `Overlaps the "${clash.name}" band (${clash.startTime}–${clash.endTime}) — bands must not overlap.`;
      }
      const existingIdx = bands.findIndex(b => b.id === band.id);
      if (existingIdx === -1) {
        // Adding a new band — enforce the D-09 max-3 clamp.
        if (bands.length >= MAX_TOU_BANDS) {
          return `You can configure at most ${MAX_TOU_BANDS} time-of-use bands.`;
        }
        onElectricityChange({ ...electricity, touBands: [...bands, band] });
        return null;
      }
      const nextBands = bands.slice();
      nextBands[existingIdx] = band;
      onElectricityChange({ ...electricity, touBands: nextBands });
      return null;
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

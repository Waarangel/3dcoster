import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';
import { parseThreeMf } from './threeMfParser';

// Helper: build a synthetic .3mf ZIP with the given slice_info.config XML content
async function makeSlicedZip(xmlContent: string): Promise<File> {
  const zip = new JSZip();
  zip.file('Metadata/slice_info.config', xmlContent);
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'test.3mf');
}

// Helper: build a ZIP with NO slice_info.config (non-sliced 3MF)
async function makeUnslicedZip(): Promise<File> {
  const zip = new JSZip();
  zip.file('3D/3dmodel.model', '<model/>');
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'unsliced.3mf');
}

// Standard multi-plate XML fixture (2 plates, PLA on both, PETG on plate 1)
const MULTI_PLATE_XML = `<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="3600"/>
    <filament id="1" type="PLA" color="#FFFFFF" used_m="12.34" used_g="36.12"/>
    <filament id="2" type="PETG" color="#000000" used_m="3.21" used_g="9.20"/>
  </plate>
  <plate>
    <metadata key="index" value="2"/>
    <metadata key="prediction" value="1800"/>
    <filament id="1" type="PLA" color="#FFFFFF" used_m="5.11" used_g="15.01"/>
  </plate>
</config>`;

// XML with an unused AMS slot (used_g="0")
const ZERO_GRAM_XML = `<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="3600"/>
    <filament id="1" type="PLA" color="#FFFFFF" used_m="12.34" used_g="36.12"/>
    <filament id="2" type="PETG" color="#000000" used_m="0" used_g="0"/>
    <filament id="3" type="ABS" color="#FF0000" used_m="0" used_g="0"/>
    <filament id="4" type="ASA" color="#00FF00" used_m="0" used_g="0"/>
  </plate>
</config>`;

// XML where used_g is absent but used_m is present (older slicer export)
const USED_M_ONLY_XML = `<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="1800"/>
    <filament id="1" type="PLA" color="#FFFFFF" used_m="10.00"/>
  </plate>
</config>`;

describe('parseThreeMf', () => {
  // --- 3MF-01: per-plate extraction ---
  it('Test 1 (3MF-01): extracts per-plate filaments and print time from a valid sliced ZIP', async () => {
    const file = await makeSlicedZip(MULTI_PLATE_XML);
    const result = await parseThreeMf(file);

    expect(result.isSliced).toBe(true);
    expect(result.plates).toHaveLength(2);

    const plate1 = result.plates[0];
    expect(plate1.index).toBe(1);
    expect(plate1.printTimeSeconds).toBe(3600);
    expect(plate1.filaments).toHaveLength(2);
    expect(plate1.filaments[0]).toEqual({ slot: 1, type: 'PLA', grams: 36.12 });
    expect(plate1.filaments[1]).toEqual({ slot: 2, type: 'PETG', grams: 9.20 });

    const plate2 = result.plates[1];
    expect(plate2.index).toBe(2);
    expect(plate2.printTimeSeconds).toBe(1800);
    expect(plate2.filaments).toHaveLength(1);
    expect(plate2.filaments[0]).toEqual({ slot: 1, type: 'PLA', grams: 15.01 });
  });

  // --- 3MF-02: cross-plate aggregation ---
  it('Test 2 (3MF-02): aggregates filamentsByType and totalPrintTimeHours across plates', async () => {
    const file = await makeSlicedZip(MULTI_PLATE_XML);
    const result = await parseThreeMf(file);

    // PLA: 36.12 (plate1) + 15.01 (plate2) = 51.13
    const pla = result.filamentsByType.find(f => f.type === 'PLA');
    expect(pla).toBeDefined();
    expect(pla!.grams).toBeCloseTo(51.13, 1);

    // PETG: 9.20 (plate1 only)
    const petg = result.filamentsByType.find(f => f.type === 'PETG');
    expect(petg).toBeDefined();
    expect(petg!.grams).toBeCloseTo(9.20, 1);

    // totalPrintTimeHours: (3600 + 1800) / 3600 = 1.5
    expect(result.totalPrintTimeHours).toBe(1.5);
  });

  // --- 3MF-03: non-sliced detection ---
  it('Test 3 (3MF-03): returns isSliced=false when slice_info.config is absent', async () => {
    const file = await makeUnslicedZip();
    const result = await parseThreeMf(file);

    expect(result.isSliced).toBe(false);
    expect(result.plates).toHaveLength(0);
    expect(result.plateCount).toBe(0);
    expect(result.totalPrintTimeHours).toBe(0);
    expect(result.filamentsByType).toHaveLength(0);
  });

  // --- 3MF-04: plate count ---
  it('Test 4 (3MF-04): plateCount equals number of <plate> elements', async () => {
    const file = await makeSlicedZip(MULTI_PLATE_XML);
    const result = await parseThreeMf(file);

    expect(result.plateCount).toBe(2);
  });

  // --- Zero-gram filtering ---
  it('Test 5: filters out filament entries with used_g="0" (unused AMS slots)', async () => {
    const file = await makeSlicedZip(ZERO_GRAM_XML);
    const result = await parseThreeMf(file);

    expect(result.plates[0].filaments).toHaveLength(1);
    expect(result.plates[0].filaments[0].type).toBe('PLA');

    // filamentsByType should only contain PLA
    expect(result.filamentsByType).toHaveLength(1);
    expect(result.filamentsByType[0].type).toBe('PLA');
  });

  // --- used_m fallback ---
  it('Test 6: calculates grams via getMaterialDensity fallback when used_g is absent', async () => {
    const file = await makeSlicedZip(USED_M_ONLY_XML);
    const result = await parseThreeMf(file);

    expect(result.plates[0].filaments).toHaveLength(1);
    const f = result.plates[0].filaments[0];
    // 10m PLA: 10 * 1000mm * PI * (1.75/2/10)^2 cm^2 * 1.24 g/cm^3
    // = 10000 mm * PI * (0.0875 cm)^2 * 1.24
    // = 10000 * 3.14159 * 0.00766 * 1.24 ≈ 297.56 g (using metres not mm)
    // Correct: 10 metres * 1000 = 10000 mm → but formula uses metres:
    // metres * 1000 * PI * (1.75/2/10)^2 * density
    // = 10 * 1000 * PI * (0.0875)^2 * 1.24
    // = 10000 * PI * 0.00765625 * 1.24 ≈ 297.56
    expect(f.grams).toBeGreaterThan(0);
    expect(f.type).toBe('PLA');
    // Rough sanity check: 10m of PLA 1.75mm should be ~30g (not ~300g)
    // Formula: 10m * PI * (0.875mm)^2 * 1.24g/cm³
    // radius in cm = 0.875/10 = 0.0875 cm
    // volume = 10*100 cm * PI * 0.0875^2 = 1000 * 0.024053 = 24.05 cm³
    // grams = 24.05 * 1.24 = 29.82g
    expect(f.grams).toBeCloseTo(29.82, 0);
  });
});

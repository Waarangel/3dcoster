// 3DCoster — UAT test-data seeder (browser console snippet).
//
// HOW TO USE:
//   1. Open the app at http://localhost:4173/app in your browser.
//   2. (Clear the stale service worker first — see UAT checklist.)
//   3. Open DevTools console (⌥⌘I → Console), paste this WHOLE file, press Enter.
//   4. RELOAD the page. The seeded data appears in Jobs / Assets / Customers / Reports.
//
// All seeded records use fixed `test-*` ids, so re-running just overwrites them
// (no duplicates). It references your existing default printer + filament so the
// rows render correctly, and stamps everything in your current display currency.
//
// To remove the test data: delete the `test-*` rows from each section in the UI,
// or run `indexedDB.deleteDatabase('3DCosterDB')` to wipe everything (defaults re-seed).

(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('3DCosterDB'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await open();
  const getAll = (store) => new Promise((res) => { const tx = db.transaction(store, 'readonly'); const rq = tx.objectStore(store).getAll(); rq.onsuccess = () => res(rq.result); });

  const mats = await getAll('materials');
  const printer = mats.find(a => a.category === 'printer');
  const filament = mats.find(a => a.category === 'filament');
  if (!printer || !filament) { db.close(); return 'ERROR: no default printer/filament found — open the app once so defaults seed, then re-run.'; }

  let currency = 'USD';
  try {
    const s = await new Promise((res) => { const tx = db.transaction('settings', 'readonly'); const rq = tx.objectStore('settings').get('userProfile'); rq.onsuccess = () => res(rq.result); });
    if (s) { const p = JSON.parse(s.value); if (p && p.currency) currency = p.currency; }
  } catch { /* fall back to USD */ }

  const now = new Date();
  const records = {
    materials: [
      { id: 'test-tester-1', name: 'UAT Test Widget', category: 'tester', currency, unit: 'g', costPerUnit: 0.05, unitsPerPackage: 1000, packageCost: 50 },
    ],
    printerInstances: [
      { id: 'test-printer-inst-1', printerConfigId: printer.id, nickname: 'UAT Test Printer', printHours: 120, actualPurchasePrice: 300, recoveryMonths: 12, estimatedMonthlyPrintHours: 60 },
    ],
    jobs: [
      // Sold on Etsy (8 copies) — use this for the net-margin break-even check.
      { id: 'test-job-etsy', name: 'UAT Etsy Keychain', createdAt: now, updatedAt: now, filaments: [{ filamentId: filament.id, grams: 25 }], printTimeHours: 1.5, printerInstanceId: 'test-printer-inst-1', modelCost: 0, prepTimeMinutes: 5, postProcessingMinutes: 10, materialsUsed: [], failureRate: 5, costPerUnit: 3.5, sellingPrice: 12, copiesSold: 8, marketplace: 'etsy', currency, fixedCostsAtSave: { depreciation: 0.2, nozzleWear: 0.05 } },
      // Unsold direct job (0 copies) — theoretical break-even.
      { id: 'test-job-plain', name: 'UAT Desk Organizer', createdAt: now, updatedAt: now, filaments: [{ filamentId: filament.id, grams: 80 }], printTimeHours: 4, printerInstanceId: 'test-printer-inst-1', modelCost: 2, prepTimeMinutes: 5, postProcessingMinutes: 15, materialsUsed: [], failureRate: 5, costPerUnit: 6, sellingPrice: 18, copiesSold: 0, currency, fixedCostsAtSave: { depreciation: 0.5, nozzleWear: 0.1 } },
    ],
    sales: [
      // Etsy sale with a recorded marketplace fee — drives the net break-even pill.
      { id: 'test-sale-etsy', jobId: 'test-job-etsy', quantity: 8, unitPrice: 12, totalRevenue: 96, soldAt: now, marketplace: 'etsy', marketplaceFee: 9.12, currency, customer: { name: 'Jane Maker', email: 'jane@example.com' } },
    ],
    customers: [
      { id: 'test-cust-1', name: 'Jane Maker', email: 'jane@example.com', company: 'Maker Co', createdAt: now },
    ],
    stockEvents: [
      // 1000 g of manual stock on a filament — for the stock-deduction check.
      { id: 'test-stock-1', assetId: filament.id, delta: 1000, kind: 'manual', refId: 'test-seed', timestamp: now, note: 'UAT seed stock (1000 g)' },
    ],
  };

  const stores = Object.keys(records);
  await new Promise((res, rej) => {
    const tx = db.transaction(stores, 'readwrite');
    for (const store of stores) { const os = tx.objectStore(store); for (const rec of records[store]) os.put(rec); }
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();

  return { seeded: { customCategoryAsset: 1, printerInstance: 1, jobs: 2, sales: 1, customers: 1, stockEvents: 1 }, referencedPrinter: printer.name, referencedFilament: filament.name, currency, NEXT: 'RELOAD the page to see the data.' };
})();

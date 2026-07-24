// ---------------------------------------------------------------------------
// Phase 47-03 (D-06) — non-extractable CryptoKey cache in IndexedDB.
//
// A derived key is "typed once per device, cached thereafter" (D-06): the
// user enters the passphrase, syncCrypto.deriveKeyFromPassphrase produces a
// non-extractable CryptoKey, and this module persists it so the passphrase
// prompt does not re-appear on every sync cycle.
//
// A tiny dedicated IndexedDB key-value store, own DB name, one object store
// keyed by accountId — mirrors src/utils/syncFileIO.ts's hand-rolled
// openHandleDb/idbGet/idbSet/idbClear pattern exactly. A CryptoKey is
// structured-clonable just like a FileSystemDirectoryHandle, so it stores
// the same way and CANNOT go through db/database.ts's setSetting
// (JSON.stringify would either throw or silently drop the actual key
// material). This is deliberately NOT localStorage: localStorage would
// require an EXTRACTABLE raw-byte key to serialize into a string at all,
// which defeats the point of a non-extractable CryptoKey (T-47-10).
// ---------------------------------------------------------------------------

const KEY_DB_NAME = '3dcoster-sync-keys';
const KEY_STORE_NAME = 'derivedKeys';

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(KEY_STORE_NAME)) {
        req.result.createObjectStore(KEY_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persists `key` as the cached derived key for `accountId` (overwrites any prior entry). */
export async function cacheDerivedKey(accountId: string, key: CryptoKey): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
    tx.objectStore(KEY_STORE_NAME).put(key, accountId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Returns the cached derived key for `accountId`, or `null` if nothing has
 * been cached for this account on this device yet (the passphrase has not
 * been entered here — RESEARCH.md Pitfall 5: signed-in is not the same as
 * having the derived key).
 */
export async function getCachedDerivedKey(accountId: string): Promise<CryptoKey | null> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readonly');
    const req = tx.objectStore(KEY_STORE_NAME).get(accountId);
    req.onsuccess = () => resolve((req.result as CryptoKey | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Forgets the cached derived key for `accountId` (e.g. on sign-out). */
export async function clearDerivedKey(accountId: string): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
    tx.objectStore(KEY_STORE_NAME).delete(accountId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

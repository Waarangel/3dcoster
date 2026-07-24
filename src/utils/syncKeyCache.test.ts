// ---------------------------------------------------------------------------
// Phase 47-03 (D-06) — non-extractable CryptoKey cache in IndexedDB.
// TDD suite written BEFORE src/utils/syncKeyCache.ts.
//
// Contract locks:
//  - cacheDerivedKey then getCachedDerivedKey returns a usable CryptoKey
//    that decrypts what it encrypted.
//  - getCachedDerivedKey returns null when nothing is cached for the account.
//  - clearDerivedKey removes the cached key (subsequent get returns null).
//  - keys are stored per-accountId (two accounts do not collide).
// ---------------------------------------------------------------------------

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { cacheDerivedKey, getCachedDerivedKey, clearDerivedKey } from './syncKeyCache';
import { encryptSyncFile, decryptSyncFile } from './syncCrypto';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';

async function randomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

beforeEach(() => {
  // Fresh fake-indexeddb state per test — no cross-test leakage of a real
  // shared DB name. Assigned via globalThis (not a bare `indexedDB =`
  // reassignment) so the no-global-assign lint rule stays intact everywhere
  // else in the codebase.
  globalThis.indexedDB = new IDBFactory();
});

describe('syncKeyCache', () => {
  it('returns null when nothing is cached for the account', async () => {
    const result = await getCachedDerivedKey(ACCOUNT_A);
    expect(result).toBeNull();
  });

  it('caches then retrieves a usable CryptoKey that decrypts what it encrypted', async () => {
    const key = await randomKey();
    await cacheDerivedKey(ACCOUNT_A, key);

    const cached = await getCachedDerivedKey(ACCOUNT_A);
    expect(cached).not.toBeNull();

    const plaintext = new TextEncoder().encode('round-trip through the cache');
    const ciphertext = await encryptSyncFile(plaintext, key);
    const decrypted = await decryptSyncFile(ciphertext, cached as CryptoKey);

    expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
  });

  it('removes the cached key via clearDerivedKey; subsequent get returns null', async () => {
    const key = await randomKey();
    await cacheDerivedKey(ACCOUNT_A, key);
    expect(await getCachedDerivedKey(ACCOUNT_A)).not.toBeNull();

    await clearDerivedKey(ACCOUNT_A);

    expect(await getCachedDerivedKey(ACCOUNT_A)).toBeNull();
  });

  it('keys are stored per-accountId — two accounts do not collide', async () => {
    const keyA = await randomKey();
    const keyB = await randomKey();
    await cacheDerivedKey(ACCOUNT_A, keyA);
    await cacheDerivedKey(ACCOUNT_B, keyB);

    const plaintext = new TextEncoder().encode('per-account isolation check');
    const ciphertextA = await encryptSyncFile(plaintext, keyA);

    const cachedA = await getCachedDerivedKey(ACCOUNT_A);
    const cachedB = await getCachedDerivedKey(ACCOUNT_B);

    // cachedA can decrypt what keyA encrypted.
    const decryptedWithA = await decryptSyncFile(ciphertextA, cachedA as CryptoKey);
    expect(Array.from(decryptedWithA)).toEqual(Array.from(plaintext));

    // cachedB (a different key) cannot.
    await expect(decryptSyncFile(ciphertextA, cachedB as CryptoKey)).rejects.toThrow();
  });

  it('clearing one account does not affect another account\'s cached key', async () => {
    const keyA = await randomKey();
    const keyB = await randomKey();
    await cacheDerivedKey(ACCOUNT_A, keyA);
    await cacheDerivedKey(ACCOUNT_B, keyB);

    await clearDerivedKey(ACCOUNT_A);

    expect(await getCachedDerivedKey(ACCOUNT_A)).toBeNull();
    expect(await getCachedDerivedKey(ACCOUNT_B)).not.toBeNull();
  });
});

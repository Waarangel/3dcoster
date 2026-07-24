// ---------------------------------------------------------------------------
// Phase 47-03 (D-05/D-06/D-07, SYNC-02) — zero-knowledge crypto layer.
// TDD suite written BEFORE src/utils/syncCrypto.ts.
//
// Contract locks:
//  - encryptSyncFile/decryptSyncFile: AES-256-GCM round-trip returns
//    byte-identical plaintext; a wrong key fails to decrypt (auth-tag check).
//  - A fresh 12-byte IV is generated per encryption and prepended to the
//    ciphertext (never reused).
//  - deriveKeyFromPassphrase + deriveSaltFromAccountId are deterministic:
//    same passphrase+accountId always yields a key that decrypts what an
//    independently-derived (but input-identical) key encrypted.
//  - deriveSaltFromAccountId returns 32 deterministic bytes; different
//    account ids produce different salts.
//  - ARGON2ID_PARAMS is a fixed exported constant (Pitfall 3 — never a
//    mutable config value).
//  - checkPassphraseStrength rejects a weak passphrase, accepts a strong one.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  encryptSyncFile,
  decryptSyncFile,
  deriveKeyFromPassphrase,
  deriveSaltFromAccountId,
  ARGON2ID_PARAMS,
  checkPassphraseStrength,
} from './syncCrypto';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';

async function randomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

describe('syncCrypto — encryptSyncFile/decryptSyncFile', () => {
  it('round-trips a byte payload through encrypt then decrypt unchanged', async () => {
    const key = await randomKey();
    const plaintext = new TextEncoder().encode(JSON.stringify({ hello: 'sync', n: 42 }));

    const ciphertext = await encryptSyncFile(plaintext, key);
    const decrypted = await decryptSyncFile(ciphertext, key);

    expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
  });

  it('rejects decryption with a different key (AES-GCM auth-tag failure)', async () => {
    const key = await randomKey();
    const wrongKey = await randomKey();
    const plaintext = new TextEncoder().encode('sensitive backup payload');

    const ciphertext = await encryptSyncFile(plaintext, key);

    await expect(decryptSyncFile(ciphertext, wrongKey)).rejects.toThrow();
  });

  it('never reuses the IV across two encryptions of the same plaintext', async () => {
    const key = await randomKey();
    const plaintext = new TextEncoder().encode('same input, different IV each time');

    const first = await encryptSyncFile(plaintext, key);
    const second = await encryptSyncFile(plaintext, key);

    const firstIv = first.slice(0, 12);
    const secondIv = second.slice(0, 12);

    expect(Array.from(firstIv)).not.toEqual(Array.from(secondIv));
    // Different IVs on identical plaintext also means different ciphertext bytes.
    expect(Array.from(first)).not.toEqual(Array.from(second));
  });

  it('prepends a 12-byte IV to the ciphertext output', async () => {
    const key = await randomKey();
    const plaintext = new TextEncoder().encode('x');

    const combined = await encryptSyncFile(plaintext, key);

    // AES-GCM appends a 16-byte auth tag to the ciphertext by default in WebCrypto.
    expect(combined.byteLength).toBe(12 + plaintext.byteLength + 16);
  });
});

describe('syncCrypto — deriveSaltFromAccountId', () => {
  it('returns 32 deterministic bytes for the same account id', async () => {
    const saltOne = await deriveSaltFromAccountId(ACCOUNT_A);
    const saltTwo = await deriveSaltFromAccountId(ACCOUNT_A);

    expect(saltOne.byteLength).toBe(32);
    expect(Array.from(saltOne)).toEqual(Array.from(saltTwo));
  });

  it('returns a different salt for a different account id', async () => {
    const saltA = await deriveSaltFromAccountId(ACCOUNT_A);
    const saltB = await deriveSaltFromAccountId(ACCOUNT_B);

    expect(Array.from(saltA)).not.toEqual(Array.from(saltB));
  });
});

describe('syncCrypto — ARGON2ID_PARAMS', () => {
  it('is a fixed constant with the documented values', () => {
    expect(ARGON2ID_PARAMS).toEqual({
      parallelism: 1,
      iterations: 3,
      memorySize: 65536,
      hashLength: 32,
    });
  });
});

describe('syncCrypto — deriveKeyFromPassphrase', () => {
  it('is deterministic: two independently-derived keys from the same inputs interoperate', async () => {
    const salt = await deriveSaltFromAccountId(ACCOUNT_A);
    const passphrase = 'correct horse battery staple 42!';

    const keyOne = await deriveKeyFromPassphrase(passphrase, salt);
    const keyTwo = await deriveKeyFromPassphrase(passphrase, salt);

    const plaintext = new TextEncoder().encode('deterministic KDF check');
    const ciphertext = await encryptSyncFile(plaintext, keyOne);
    const decrypted = await decryptSyncFile(ciphertext, keyTwo);

    expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
  }, 20000);

  it('derives a non-extractable CryptoKey usable only for AES-GCM encrypt/decrypt', async () => {
    const salt = await deriveSaltFromAccountId(ACCOUNT_A);
    const key = await deriveKeyFromPassphrase('another strong passphrase 7!', salt);

    expect(key.extractable).toBe(false);
    expect(key.usages.sort()).toEqual(['decrypt', 'encrypt']);
    expect(key.algorithm.name).toBe('AES-GCM');
  }, 20000);

  it('produces a different key for a different passphrase (same salt)', async () => {
    const salt = await deriveSaltFromAccountId(ACCOUNT_A);
    const keyOne = await deriveKeyFromPassphrase('passphrase one is strong 7!', salt);
    const keyTwo = await deriveKeyFromPassphrase('passphrase two is strong 9!', salt);

    const plaintext = new TextEncoder().encode('must not decrypt across passphrases');
    const ciphertext = await encryptSyncFile(plaintext, keyOne);

    await expect(decryptSyncFile(ciphertext, keyTwo)).rejects.toThrow();
  }, 20000);
});

describe('syncCrypto — checkPassphraseStrength', () => {
  it('rejects a common weak passphrase', async () => {
    const result = await checkPassphraseStrength('password1');
    expect(result.ok).toBe(false);
    expect(result.score).toBeLessThan(3);
  });

  it('accepts a strong, long, unpredictable passphrase', async () => {
    const result = await checkPassphraseStrength('correct horse battery staple 42 zebra!');
    expect(result.ok).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });
});

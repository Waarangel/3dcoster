// ---------------------------------------------------------------------------
// Phase 47-03 (D-05/D-06/D-07, SYNC-02) — the zero-knowledge crypto layer.
//
// PURE module: no IndexedDB, no React, no Supabase. Operates only on bytes,
// CryptoKeys, and passphrase strings. The cached-key store lives in the
// sibling syncKeyCache.ts; the actual sync-file envelope shape lives in
// backupSchema.ts — this module never imports either.
//
// This is where the app's "we can't read your data" promise is made real:
// AES-256-GCM (native WebCrypto) encrypts the sync-file bytes, Argon2id
// (hash-wasm, lazy WASM) derives the key from the user's passphrase, and a
// deterministic per-account salt (SHA-256 of auth.uid()) resolves the D-06
// "need a KDF salt" vs D-08 "no extra server-stored columns" tension without
// any new server storage (RESEARCH.md Architecture Pattern 2).
// ---------------------------------------------------------------------------

/**
 * Fixed Argon2id parameters — these are part of the account's cryptographic
 * identity, NOT a tunable runtime setting. Every device deriving the key for
 * the same account must use identical params, or sync silently fails to
 * decrypt for whichever device is out of date (RESEARCH.md Pitfall 3).
 *
 * Changing ANY of these values requires a coordinated re-key migration
 * (re-encrypt under both old and new params during a transition window),
 * never a silent bump. m=64MiB/t=3/p=1 sits above OWASP's 19 MiB minimum and
 * is desktop/modern-mobile safe (RESEARCH.md Assumption A1).
 */
export const ARGON2ID_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MiB
  hashLength: 32, // 256-bit key for AES-256-GCM
} as const;

/** Length in bytes of the random AES-GCM IV prepended to every ciphertext. */
const IV_LENGTH_BYTES = 12;

/**
 * Encrypts `bytes` with AES-256-GCM under `key`. A fresh 12-byte IV is
 * generated per call via `crypto.getRandomValues` — an IV must never be
 * reused with the same key — and is prepended to the returned ciphertext
 * (the IV is not secret; it must travel with the ciphertext to decrypt).
 */
export async function encryptSyncFile(
  bytes: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return combined;
}

/**
 * Decrypts a `combined` (IV + ciphertext) blob produced by `encryptSyncFile`
 * back to the original bytes. Throws if `key` is wrong or the blob was
 * tampered with — AES-GCM's authentication tag makes a wrong-key or
 * corrupted decrypt fail loudly rather than silently returning garbage.
 */
export async function decryptSyncFile(
  combined: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = combined.slice(0, IV_LENGTH_BYTES);
  const ciphertext = combined.slice(IV_LENGTH_BYTES);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(plaintext);
}

/**
 * Derives a deterministic, non-secret 32-byte KDF salt from the signed-in
 * account's id (`auth.uid()`). A salt's purpose is to defeat rainbow-table
 * reuse ACROSS different accounts — a per-account-unique deterministic value
 * satisfies that exactly as well as a random one, since no two accounts
 * share a uid, and it needs zero new server-stored columns (D-06/D-08
 * resolution, RESEARCH.md Architecture Pattern 2 / Assumption A2).
 */
export async function deriveSaltFromAccountId(accountId: string): Promise<Uint8Array<ArrayBuffer>> {
  const encoded = new TextEncoder().encode(accountId);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(hash);
}

/**
 * Derives a non-extractable AES-256-GCM `CryptoKey` from a user passphrase
 * and salt via Argon2id (memory-hard KDF — a naive SHA-256(passphrase) "key"
 * would be trivially GPU-crackable for human-chosen secrets, RESEARCH.md
 * Don't-Hand-Roll). The `extractable` flag is `false`: even a successful XSS
 * cannot exfiltrate the raw key bytes, only use the key via WebCrypto calls.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const { argon2id } = await import('hash-wasm');
  const rawKey = await argon2id({
    password: passphrase,
    salt,
    parallelism: ARGON2ID_PARAMS.parallelism,
    iterations: ARGON2ID_PARAMS.iterations,
    memorySize: ARGON2ID_PARAMS.memorySize,
    hashLength: ARGON2ID_PARAMS.hashLength,
    outputType: 'binary',
  });
  // hash-wasm's own .d.ts declares a bare `Uint8Array` return (resolves to
  // Uint8Array<ArrayBufferLike> under this project's lib) — re-wrap into a
  // fresh Uint8Array<ArrayBuffer> so it satisfies WebCrypto's BufferSource.
  return crypto.subtle.importKey('raw', new Uint8Array(rawKey), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Minimum zxcvbn score required for a passphrase to be accepted. zxcvbn
 * scores run 0 (trivially guessed) to 4 (very hard to guess); 3 ("safely
 * unguessable" per zxcvbn's own scale, roughly 10^10+ guesses) is the
 * reasoned floor here — this passphrase alone stands between an offline
 * attacker and the user's decrypted PII (RESEARCH.md T-47-08), so a lower
 * floor (e.g. 2, "somewhat guessable") is not an acceptable default.
 */
const MIN_PASSPHRASE_SCORE = 3;

export interface PassphraseStrengthResult {
  /** Raw zxcvbn score, 0 (weakest) to 4 (strongest). */
  score: number;
  /** Whether the score meets MIN_PASSPHRASE_SCORE. */
  ok: boolean;
  /** zxcvbn's own user-facing feedback (warning + suggestions), if any. */
  feedback: { warning: string; suggestions: string[] };
}

/**
 * Scores passphrase strength with `@zxcvbn-ts/core` (pattern-aware,
 * dictionary-based crack-time estimation — RESEARCH.md Don't-Hand-Roll: a
 * hand-rolled length/character-class rule is well-documented weak signal).
 * zxcvbn and its dictionaries are dynamically imported so they never load on
 * the free floor — this check only runs on the Pro cloud-sync setup flow.
 */
export async function checkPassphraseStrength(passphrase: string): Promise<PassphraseStrengthResult> {
  const [{ ZxcvbnFactory }, zxcvbnCommonPackage, zxcvbnEnPackage] = await Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-en'),
  ]);

  const zxcvbn = new ZxcvbnFactory({
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnEnPackage.dictionary,
    },
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    translations: zxcvbnEnPackage.translations,
  });

  const result = zxcvbn.check(passphrase);
  return {
    score: result.score,
    ok: result.score >= MIN_PASSPHRASE_SCORE,
    feedback: {
      warning: result.feedback.warning ?? '',
      suggestions: result.feedback.suggestions,
    },
  };
}

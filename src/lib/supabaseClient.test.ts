import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// supabaseClient gate tests (Phase 46-02, D-08 — desktop un-gated).
//
// The singleton is evaluated at module load, so every test stubs env vars
// FIRST, resets the module registry, and then dynamically imports a fresh
// copy of the module under that configuration.
//
// createClient is mocked — these tests assert the GATE (null vs client and
// the options passed), not supabase-js internals. D-08 removed the
// __IS_TAURI__ -> null gate entirely, so __IS_TAURI__ no longer affects
// buildClient() at all — both platforms now share one env-var-only gate.
// ---------------------------------------------------------------------------

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ __mockClient: true })),
}));

const TEST_URL = 'https://example-project.supabase.co';
const TEST_ANON_KEY = 'test-anon-key';

describe('supabaseClient', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('creates a real client under __IS_TAURI__ when env vars are configured (D-08 desktop un-gate)', async () => {
    vi.stubGlobal('__IS_TAURI__', true);
    vi.stubEnv('VITE_SUPABASE_URL', TEST_URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', TEST_ANON_KEY);

    const { supabase } = await import('./supabaseClient');
    const { createClient } = await import('@supabase/supabase-js');

    // D-08 reverses Phase 43's D-12 web-first gate: desktop now constructs a
    // real client exactly like web when Supabase env vars are present.
    expect(supabase).not.toBeNull();
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('creates a web client with PKCE + persisted session when configured', async () => {
    vi.stubGlobal('__IS_TAURI__', false);
    vi.stubEnv('VITE_SUPABASE_URL', TEST_URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', TEST_ANON_KEY);

    const { supabase } = await import('./supabaseClient');
    const { createClient } = await import('@supabase/supabase-js');

    expect(supabase).not.toBeNull();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      TEST_URL,
      TEST_ANON_KEY,
      expect.objectContaining({
        auth: expect.objectContaining({
          // Magic-link flow uses PKCE — never the deprecated implicit
          // location.hash token pattern (plan Task 1 action 2).
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
        }),
      }),
    );
  });

  it('degrades to null with a console.warn (never a throw) when env vars are missing on web', async () => {
    vi.stubGlobal('__IS_TAURI__', false);
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { supabase } = await import('./supabaseClient');
    const { createClient } = await import('@supabase/supabase-js');

    // The free floor must keep working with zero backend config (PRO-01):
    // a misconfigured web deploy disables Pro sign-in, it does not crash.
    expect(supabase).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('degrades to null with a console.warn when env vars are missing on desktop too (PRO-01 free floor)', async () => {
    vi.stubGlobal('__IS_TAURI__', true);
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { supabase } = await import('./supabaseClient');
    const { createClient } = await import('@supabase/supabase-js');

    // An unconfigured desktop build (no Supabase secrets baked in) must
    // degrade gracefully, exactly like an unconfigured web deploy.
    expect(supabase).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

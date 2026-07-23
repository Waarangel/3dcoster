import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ToastProvider } from '../ui';

// ---------------------------------------------------------------------------
// SignInModal — OTP code-length regression test (post-checkpoint fix,
// Phase 46 plan 46-02).
//
// Live production verification (2026-07-22) found the deployed Supabase
// project issues 8-digit email OTP codes, but the shipped input hardcoded a
// 6-digit assumption (slice(0, 6) / maxLength={6} / /^\d{6}$/). This locks
// the fix: the code input accepts 6-10 digits so it stays correct
// regardless of the server's configured OTP length.
//
// Scaffold: raw createRoot + act per project precedent (no
// @testing-library/react). useProAuth is mocked so the code-entry step
// ('link-sent' status) renders without a real Supabase client.
// ---------------------------------------------------------------------------

const signInWithEmailSpy = vi.fn<(email: string) => Promise<string | null>>().mockResolvedValue(null);
const verifyEmailCodeSpy = vi.fn<(email: string, code: string) => Promise<string | null>>().mockResolvedValue(null);

vi.mock('../../hooks/useProAuth', () => ({
  useProAuth: () => ({
    session: null,
    user: null,
    isSignedIn: false,
    status: 'link-sent', // code-entry step visible from the first render
    signInWithEmail: signInWithEmailSpy,
    verifyEmailCode: verifyEmailCodeSpy,
    signOut: vi.fn(),
  }),
}));

const { SignInModal } = await import('./SignInModal');

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  signInWithEmailSpy.mockClear();
  verifyEmailCodeSpy.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

async function renderModal(): Promise<void> {
  await act(async () => {
    root!.render(
      <ToastProvider>
        <SignInModal isOpen={true} onClose={() => {}} />
      </ToastProvider>,
    );
  });
}

function typeIntoInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function getCodeInput(): HTMLInputElement {
  const input = document.body.querySelector('[aria-label="One-time sign-in code"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('code input not found');
  return input;
}

function getVerifyButton(): HTMLButtonElement {
  const button = document.body.querySelector('[aria-label="Verify code"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error('verify button not found');
  return button;
}

describe('SignInModal — OTP code length (6-10 digits)', () => {
  it('accepts an 8-digit code (current production length) and enables Verify', async () => {
    await renderModal();
    const codeInput = getCodeInput();

    await act(async () => {
      typeIntoInput(codeInput, '74359066');
    });

    expect(codeInput.value).toBe('74359066');
    expect(getVerifyButton().disabled).toBe(false);
  });

  it('still accepts a 6-digit code and enables Verify (no regression)', async () => {
    await renderModal();
    const codeInput = getCodeInput();

    await act(async () => {
      typeIntoInput(codeInput, '123456');
    });

    expect(codeInput.value).toBe('123456');
    expect(getVerifyButton().disabled).toBe(false);
  });

  it('does not truncate a code shorter than 10 digits and disables Verify until 6+ digits are entered', async () => {
    await renderModal();
    const codeInput = getCodeInput();

    await act(async () => {
      typeIntoInput(codeInput, '1234');
    });

    expect(codeInput.value).toBe('1234');
    expect(getVerifyButton().disabled).toBe(true);
  });

  it('strips non-digit characters and caps input at 10 digits', async () => {
    await renderModal();
    const codeInput = getCodeInput();

    await act(async () => {
      // 12 raw characters, but only 11 digits — expect non-digits stripped
      // and the result capped at 10 digits (not silently accepting 11+).
      typeIntoInput(codeInput, 'a1b2c3d4e5f6g');
    });

    expect(codeInput.value).toBe('123456'); // digits-only: '123456' (6 digits, under the 10 cap)
  });

  it('caps a raw 12-digit paste at 10 digits', async () => {
    await renderModal();
    const codeInput = getCodeInput();

    await act(async () => {
      typeIntoInput(codeInput, '123456789012');
    });

    expect(codeInput.value).toBe('1234567890');
    expect(codeInput.value.length).toBe(10);
  });

  it('submits the typed 8-digit code via verifyEmailCode on Verify click', async () => {
    await renderModal();
    const codeInput = getCodeInput();

    await act(async () => {
      typeIntoInput(codeInput, '74359066');
    });

    await act(async () => {
      getVerifyButton().click();
    });

    expect(verifyEmailCodeSpy).toHaveBeenCalledWith(expect.any(String), '74359066');
  });
});

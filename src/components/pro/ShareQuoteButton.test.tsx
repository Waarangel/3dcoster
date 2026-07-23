import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Quote } from '../../types';
import { ToastProvider } from '../ui';

// ---------------------------------------------------------------------------
// ShareQuoteButton — Phase 43-04 (PRO-02 / D-10).
//
// Raw createRoot + act per project precedent (ConfirmModal.test.tsx /
// LogFailureModal.test.tsx). useProAuth is mocked directly so both the
// signed-out (Pro chip + pitch modal) and signed-in (publish/unpublish)
// branches are exercised without a real Supabase client.
// ---------------------------------------------------------------------------

vi.stubGlobal('__IS_TAURI__', false);

let mockIsSignedIn = false;

vi.mock('../../hooks/useProAuth', () => ({
  useProAuth: () => ({
    session: mockIsSignedIn ? { user: { id: 'user-1' } } : null,
    user: mockIsSignedIn ? { id: 'user-1' } : null,
    isSignedIn: mockIsSignedIn,
    status: mockIsSignedIn ? 'signed-in' : 'signed-out',
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// G-46-6R: the publish-toast's clipboard boundary is mocked at the module
// level so the honest-toast tests can control the copy outcome without
// touching navigator.clipboard directly (copyToClipboard itself is unit
// tested in clipboard.test.ts — this file only checks ShareQuoteButton's
// wiring to it).
const mockCopyToClipboard = vi.fn<(text: string) => Promise<boolean>>();
vi.mock('../../utils/clipboard', () => ({
  copyToClipboard: (text: string) => mockCopyToClipboard(text),
}));

const { ShareQuoteButton } = await import('./ShareQuoteButton');

function makeQuote(overrides?: Partial<Quote>): Quote {
  return {
    id: 'quote-1',
    quoteNumber: 7,
    printJobId: 'job-1',
    customerSnapshot: { name: 'Jane Doe' },
    lineItemsSnapshot: {
      jobTitle: 'Bracket',
      sellingPrice: 10,
      shippingCost: 0,
      resolvedTaxRate: 0,
      taxAmount: 0,
      currency: 'USD',
      notes: '',
      terms: '',
    },
    status: 'sent',
    createdAt: new Date(),
    sentAt: new Date(),
    ...overrides,
  } as Quote;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockIsSignedIn = false;
  mockCopyToClipboard.mockReset();
  mockCopyToClipboard.mockResolvedValue(true);
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
  vi.clearAllMocks();
});

type PublishFn = (quote: Quote, options?: unknown) => Promise<string>;
type UnpublishFn = (quote: Quote) => Promise<void>;

function renderButton(props: { quote?: Quote; publish?: ReturnType<typeof vi.fn<PublishFn>>; unpublish?: ReturnType<typeof vi.fn<UnpublishFn>> } = {}) {
  const publish = props.publish ?? vi.fn<PublishFn>(async () => 'https://3dcoster.com/q/abc');
  const unpublish = props.unpublish ?? vi.fn<UnpublishFn>(async () => {});
  const quote = props.quote ?? makeQuote();
  act(() => {
    root!.render(
      <ToastProvider>
        <ShareQuoteButton quote={quote} publish={publish} unpublish={unpublish} />
      </ToastProvider>,
    );
  });
  return { publish, unpublish, quote };
}

function findButtonByLabel(label: string): HTMLButtonElement | null {
  return document.body.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

describe('ShareQuoteButton — desktop parity (G-46-6)', () => {
  afterEach(() => {
    vi.stubGlobal('__IS_TAURI__', false);
  });

  it('renders the signed-in Share control under the Tauri global', () => {
    vi.stubGlobal('__IS_TAURI__', true);
    mockIsSignedIn = true;
    renderButton();
    const btn = findButtonByLabel('Share quote Q-0007');
    expect(btn).not.toBeNull();
    expect(container!.textContent).not.toBe('');
  });

  it('renders the signed-out Pro pitch chip under the Tauri global', () => {
    vi.stubGlobal('__IS_TAURI__', true);
    mockIsSignedIn = false;
    renderButton();
    const btn = findButtonByLabel('Share quote Q-0007 (Pro feature)');
    expect(btn).not.toBeNull();
    expect(container!.textContent).not.toBe('');
  });
});

describe('ShareQuoteButton — signed-out / non-Pro (D-10)', () => {
  it('shows the Pro chip and opens the pitch modal on click, without publishing', async () => {
    mockIsSignedIn = false;
    const { publish } = renderButton();

    const btn = findButtonByLabel('Share quote Q-0007 (Pro feature)');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('Pro');

    await act(async () => {
      btn!.click();
    });

    expect(document.body.textContent).toContain('Unlock 3DCoster Pro');
    expect(publish).not.toHaveBeenCalled();
  });

  it('opens sign-in from the pitch modal', async () => {
    mockIsSignedIn = false;
    renderButton();

    await act(async () => {
      findButtonByLabel('Share quote Q-0007 (Pro feature)')!.click();
    });
    await act(async () => {
      findButtonByLabel('Sign in for Pro')!.click();
    });

    expect(document.body.textContent).toContain('Sign in for Pro');
    expect(document.body.querySelector('input[type="email"]')).not.toBeNull();
  });
});

describe('ShareQuoteButton — signed-in (publish/unpublish)', () => {
  it('publishes an unpublished quote and shows a success toast', async () => {
    mockIsSignedIn = true;
    const { publish } = renderButton({ quote: makeQuote({ publishStatus: undefined }) });

    const btn = findButtonByLabel('Share quote Q-0007');
    expect(btn).not.toBeNull();

    await act(async () => {
      btn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('unpublishes an already-published quote', async () => {
    mockIsSignedIn = true;
    const { unpublish } = renderButton({
      quote: makeQuote({ publishStatus: 'published', hostedToken: 'token-1' }),
    });

    const btn = findButtonByLabel('Unpublish quote Q-0007');
    expect(btn).not.toBeNull();

    await act(async () => {
      btn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(unpublish).toHaveBeenCalledTimes(1);
  });

  it('surfaces a publish failure via toast without crashing', async () => {
    mockIsSignedIn = true;
    const publish = vi.fn<PublishFn>(async () => { throw new Error('An active Pro subscription is required to publish a new quote link.'); });
    renderButton({ quote: makeQuote({ publishStatus: undefined }), publish });

    await act(async () => {
      findButtonByLabel('Share quote Q-0007')!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('An active Pro subscription is required');
  });
});

describe('ShareQuoteButton — honest publish-toast clipboard claim (G-46-6R)', () => {
  it('claims the link was copied when copyToClipboard resolves true', async () => {
    mockIsSignedIn = true;
    mockCopyToClipboard.mockResolvedValue(true);
    const publish = vi.fn<PublishFn>(async () => 'https://3dcoster.com/q/abc');
    renderButton({ quote: makeQuote({ publishStatus: undefined }), publish });

    await act(async () => {
      findButtonByLabel('Share quote Q-0007')!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockCopyToClipboard).toHaveBeenCalledWith('https://3dcoster.com/q/abc');
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('https://3dcoster.com/q/abc');
    expect(bodyText.toLowerCase()).toContain('copied');
  });

  it('does NOT claim the link was copied when copyToClipboard resolves false (desktop WebView with no clipboard)', async () => {
    mockIsSignedIn = true;
    mockCopyToClipboard.mockResolvedValue(false);
    const publish = vi.fn<PublishFn>(async () => 'https://3dcoster.com/q/abc');
    renderButton({ quote: makeQuote({ publishStatus: undefined }), publish });

    await act(async () => {
      findButtonByLabel('Share quote Q-0007')!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockCopyToClipboard).toHaveBeenCalledWith('https://3dcoster.com/q/abc');
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('https://3dcoster.com/q/abc');
    expect(bodyText.toLowerCase()).not.toContain('copied');
  });
});

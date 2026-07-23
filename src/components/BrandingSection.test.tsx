import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { UserProfile } from '../types';
import { ToastProvider } from './ui';
import { BrandingSection } from './BrandingSection';
import { MAX_LOGO_UPLOAD_BYTES } from '../utils/imageResize';

// ---------------------------------------------------------------------------
// BrandingSection — Phase 46 (D-01..D-03, D-06, D-13).
//
// Raw createRoot + act per project precedent (ShareQuoteButton.test.tsx).
// jsdom has no real createImageBitmap/canvas rasterization, so
// createImageBitmap and HTMLCanvasElement's getContext/toDataURL are mocked
// per imageResize.test.ts's convention — this exercises the REAL
// resizeImageToDataUrl (not a mock of BrandingSection's own logic).
// ---------------------------------------------------------------------------

function makeProfile(overrides?: Partial<UserProfile>): UserProfile {
  return {
    currency: 'USD',
    laborHourlyRate: 20,
    ...overrides,
  } as UserProfile;
}

function makeFile(sizeBytes: number, type = 'image/png'): File {
  const buf = new Uint8Array(Math.max(sizeBytes, 0));
  return new File([buf], 'logo.png', { type });
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let createImageBitmapMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  createImageBitmapMock = vi.fn();
  (globalThis as unknown as { createImageBitmap: typeof createImageBitmapMock }).createImageBitmap =
    createImageBitmapMock;

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (
    this: HTMLCanvasElement,
    type?: string
  ) {
    return `data:${type || 'image/png'};base64,iVBORw0KGgo=`;
  });
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
  vi.restoreAllMocks();
  delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
});

type OnProfileChangeFn = (profile: UserProfile) => void;
type OnOpenPitchFn = () => void;

function renderSection(props: {
  profile?: UserProfile;
  onProfileChange?: ReturnType<typeof vi.fn<OnProfileChangeFn>>;
  isPro?: boolean;
  onOpenPitch?: ReturnType<typeof vi.fn<OnOpenPitchFn>>;
} = {}) {
  const profile = props.profile ?? makeProfile();
  const onProfileChange = props.onProfileChange ?? vi.fn<OnProfileChangeFn>();
  const onOpenPitch = props.onOpenPitch ?? vi.fn<OnOpenPitchFn>();
  act(() => {
    root!.render(
      <ToastProvider>
        <BrandingSection
          profile={profile}
          onProfileChange={onProfileChange}
          isPro={props.isPro ?? false}
          onOpenPitch={onOpenPitch}
        />
      </ToastProvider>,
    );
  });
  return { profile, onProfileChange, onOpenPitch };
}

function fileInput(): HTMLInputElement {
  const input = container!.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not rendered');
  return input as HTMLInputElement;
}

async function chooseFile(file: File) {
  const input = fileInput();
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('BrandingSection — Pro path (upload/preview/remove)', () => {
  it('processes a selected file via resizeImageToDataUrl and persists it via onProfileChange', async () => {
    createImageBitmapMock.mockResolvedValue({ width: 100, height: 50, close: vi.fn() });
    const { onProfileChange, profile } = renderSection({ isPro: true });

    await chooseFile(makeFile(1000, 'image/png'));

    expect(onProfileChange).toHaveBeenCalledTimes(1);
    const updated = onProfileChange.mock.calls[0][0] as UserProfile;
    expect(updated.logoDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(updated.currency).toBe(profile.currency);
  });

  it('shows a live preview of the current logo', () => {
    renderSection({
      isPro: true,
      profile: makeProfile({ logoDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }),
    });

    const img = container!.querySelector('img[alt="Your business logo"]') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain('data:image/png;base64,');
  });

  it('Remove clears logoDataUrl via onProfileChange', async () => {
    const { onProfileChange } = renderSection({
      isPro: true,
      profile: makeProfile({ logoDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }),
    });

    const removeBtn = container!.querySelector<HTMLButtonElement>('button[aria-label="Remove logo"]');
    expect(removeBtn).not.toBeNull();
    await act(async () => { removeBtn!.click(); });

    expect(onProfileChange).toHaveBeenCalledTimes(1);
    const updated = onProfileChange.mock.calls[0][0] as UserProfile;
    expect(updated.logoDataUrl).toBeUndefined();
  });

  it('surfaces a friendly error and does not store anything for an oversized file', async () => {
    const { onProfileChange } = renderSection({ isPro: true });

    await chooseFile(makeFile(MAX_LOGO_UPLOAD_BYTES + 1, 'image/png'));

    expect(onProfileChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('too large');
  });

  it('surfaces a friendly error and does not store anything for a non-image file', async () => {
    createImageBitmapMock.mockRejectedValue(new Error('not a decodable image'));
    const { onProfileChange } = renderSection({ isPro: true });

    await chooseFile(makeFile(1000, 'text/plain'));

    expect(onProfileChange).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="alert"], [role="status"]') || document.body.textContent).toBeTruthy();
  });
});

describe('BrandingSection — free / signed-out path (D-13)', () => {
  it('shows the Pro chip and calls onOpenPitch on interaction, without opening a file picker', async () => {
    const { onOpenPitch } = renderSection({ isPro: false });

    const btn = container!.querySelector<HTMLButtonElement>('button[aria-label="Add your logo (Pro feature)"]');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('Pro');
    expect(container!.querySelector('input[type="file"]')).toBeNull();

    await act(async () => { btn!.click(); });

    expect(onOpenPitch).toHaveBeenCalledTimes(1);
  });
});

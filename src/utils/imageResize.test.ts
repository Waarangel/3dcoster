import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resizeImageToDataUrl, MAX_LOGO_UPLOAD_BYTES } from './imageResize';

// ---------------------------------------------------------------------------
// Phase 46 D-01 — Canvas resize/compress helper.
//
// jsdom has no real createImageBitmap/canvas 2D rasterization, so these
// tests mock createImageBitmap and HTMLCanvasElement's getContext/toDataURL
// to exercise the size-cap reject path, the scale-clamp math, and the
// validator-gated return without needing a real image decode.
// ---------------------------------------------------------------------------

function makeFile(sizeBytes: number, type = 'image/png'): File {
  const buf = new Uint8Array(Math.max(sizeBytes, 0));
  return new File([buf], 'logo.png', { type });
}

describe('resizeImageToDataUrl', () => {
  let createImageBitmapMock: ReturnType<typeof vi.fn>;
  let capturedWidth: number | undefined;
  let capturedHeight: number | undefined;

  beforeEach(() => {
    capturedWidth = undefined;
    capturedHeight = undefined;

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
      capturedWidth = this.width;
      capturedHeight = this.height;
      return `data:${type || 'image/png'};base64,iVBORw0KGgo=`;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
  });

  it('resolves to a validated data URL starting data:image/png;base64, for a small PNG file', async () => {
    createImageBitmapMock.mockResolvedValue({ width: 100, height: 50, close: vi.fn() });
    const file = makeFile(1000, 'image/png');

    const result = await resizeImageToDataUrl(file, 480, 'image/png');

    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it('rejects when createImageBitmap throws for a non-image file (format validation)', async () => {
    createImageBitmapMock.mockRejectedValue(new Error('not a decodable image'));
    const file = makeFile(1000, 'text/plain');

    await expect(resizeImageToDataUrl(file, 480, 'image/png')).rejects.toThrow();
  });

  it('does not upscale an image whose largest dimension is already <= maxDim (scale clamped to <= 1)', async () => {
    createImageBitmapMock.mockResolvedValue({ width: 100, height: 50, close: vi.fn() });
    const file = makeFile(1000, 'image/png');

    await resizeImageToDataUrl(file, 480, 'image/png');

    expect(capturedWidth).toBe(100);
    expect(capturedHeight).toBe(50);
  });

  it('downscales an oversized image to fit within the maxDim bounding box', async () => {
    createImageBitmapMock.mockResolvedValue({ width: 2000, height: 1000, close: vi.fn() });
    const file = makeFile(1000, 'image/png');

    await resizeImageToDataUrl(file, 480, 'image/png');

    expect(capturedWidth).toBe(480);
    expect(capturedHeight).toBe(240);
  });

  it('rejects a file larger than MAX_LOGO_UPLOAD_BYTES before decode (memory-exhaustion guard)', async () => {
    const file = makeFile(MAX_LOGO_UPLOAD_BYTES + 1, 'image/png');

    await expect(resizeImageToDataUrl(file, 480, 'image/png')).rejects.toThrow();
    expect(createImageBitmapMock).not.toHaveBeenCalled();
  });
});

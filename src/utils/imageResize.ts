import { isValidLogoDataUrl } from './logoDataUrl';

// ---------------------------------------------------------------------------
// Phase 46 D-01 — native-Canvas logo resize/compress helper.
//
// RESEARCH.md Pattern 2: vanilla Canvas is simpler than importing a library
// for one small logo — no new npm dependency this phase. `createImageBitmap`
// is both the decoder AND the format-validation step: a non-image file
// simply fails to decode and the promise rejects, so we don't need a
// separate magic-byte check.
// ---------------------------------------------------------------------------

/**
 * Pre-decode byte-size cap on an uploaded logo file (Security Domain DoS
 * row / RESEARCH.md Open Question 3). Rejected BEFORE createImageBitmap is
 * called, so an oversized/malicious file never reaches decode-time memory
 * allocation.
 */
export const MAX_LOGO_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Resize an uploaded image file to fit within a `maxDim` x `maxDim`
 * bounding box and re-encode it as a validated data URL.
 *
 * Examples:
 *   resizeImageToDataUrl(pngFile, 480, 'image/png') → 'data:image/png;base64,...'
 *   resizeImageToDataUrl(jpegFile, 480, 'image/jpeg', 0.85) → 'data:image/jpeg;base64,...'
 *
 * Throws if:
 *   - `file.size` exceeds MAX_LOGO_UPLOAD_BYTES (checked before decode)
 *   - `file` cannot be decoded as an image (createImageBitmap rejects — this
 *     IS the format-validation step)
 *   - the produced data URL fails isValidLogoDataUrl (never returns an
 *     unvalidated payload)
 *
 * An image whose largest dimension is already <= maxDim is never upscaled
 * (the resize scale factor is clamped to <= 1).
 */
export async function resizeImageToDataUrl(
  file: File,
  maxDim: number,
  outputMime: 'image/png' | 'image/jpeg',
  quality?: number
): Promise<string> {
  if (file.size > MAX_LOGO_UPLOAD_BYTES) {
    throw new Error(
      `Logo file is too large (${file.size} bytes, max ${MAX_LOGO_UPLOAD_BYTES} bytes)`
    );
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(maxDim / bitmap.width, maxDim / bitmap.height, 1);
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL(outputMime, quality);
    if (!isValidLogoDataUrl(dataUrl)) {
      throw new Error('Resized logo image failed data-URL validation');
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

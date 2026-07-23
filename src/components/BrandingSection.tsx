import { useRef, useState } from 'react';
import type { UserProfile } from '../types';
import { Button, useToast } from './ui';
import { NewBadge } from './NewBadge';
import { resizeImageToDataUrl } from '../utils/imageResize';

// ---------------------------------------------------------------------------
// BrandingSection — the single management home for white-label branding
// (Phase 46, D-03). Mounted in UserProfileModal's Profile section, alongside
// the existing Name field.
//
// Pro: upload/preview/remove a logo. Processing happens entirely
// client-side via resizeImageToDataUrl (native Canvas, no new dependency —
// createImageBitmap IS the format-validation step, see imageResize.ts) and
// the result is stored on UserProfile.logoDataUrl — the same field 46-04's
// PDF export and 46-03's hosted-quote disclosure already read from.
//
// Free / signed-out: the same section frame renders with the logo slot
// behind a Pro chip (D-13 — visible to all, never hidden). Interacting opens
// the ONE bundle pitch modal (D-14) via onOpenPitch, never a second upsell
// surface — mirrors ShareQuoteButton's established Pro-chip pattern (D-10).
//
// D-06: Remove only clears UserProfile.logoDataUrl via a user action. It is
// NEVER cleared by entitlement state — a lapsed-then-resubscribed Pro user's
// last uploaded logo is still here untouched; the isPro render gate is what
// stops a free user from editing it, not data loss.
// ---------------------------------------------------------------------------

interface BrandingSectionProps {
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  isPro: boolean;
  /** Opens the one Pro bundle pitch modal (D-14). */
  onOpenPitch: () => void;
}

const LOGO_MAX_DIM = 480;
const LOGO_JPEG_QUALITY = 0.85;

export function BrandingSection({ profile, onProfileChange, isPro, onOpenPitch }: BrandingSectionProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file (e.g. after Remove then re-upload).
    e.target.value = '';
    if (!file) return;

    setIsProcessing(true);
    try {
      // Preserve transparency for png/webp sources; otherwise re-encode as a
      // compressed JPEG (RESEARCH.md Open Question 3). resizeImageToDataUrl
      // owns all real validation — the size cap (pre-decode) and the
      // createImageBitmap decode (format) — so a non-image or oversized file
      // rejects there, not here.
      const outputMime = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const logoDataUrl = await resizeImageToDataUrl(
        file,
        LOGO_MAX_DIM,
        outputMime,
        outputMime === 'image/jpeg' ? LOGO_JPEG_QUALITY : undefined
      );
      onProfileChange({ ...profile, logoDataUrl });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not process that image — please try a different file.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = () => {
    onProfileChange({ ...profile, logoDataUrl: undefined });
  };

  return (
    <div>
      <div className="relative inline-block mb-3">
        <h3 className="text-sm font-medium text-slate-300">Branding</h3>
        <NewBadge feature="white-label-branding" className="absolute -top-2 -right-9 pointer-events-none" />
      </div>

      {isPro ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Your logo replaces the &quot;Made with 3DCoster&quot; footer on PDF quotes and hosted quote pages.
          </p>
          <div className="flex items-center gap-3">
            {profile.logoDataUrl ? (
              <img
                src={profile.logoDataUrl}
                alt="Your business logo"
                className="w-16 h-16 object-contain rounded bg-white/5 border border-slate-700"
              />
            ) : (
              <div className="w-16 h-16 rounded bg-slate-800 border border-dashed border-slate-600 flex items-center justify-center text-[10px] text-slate-500 text-center px-1">
                No logo
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                btnSize="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                aria-label={profile.logoDataUrl ? 'Replace logo' : 'Upload logo'}
              >
                {isProcessing ? 'Processing…' : profile.logoDataUrl ? 'Replace logo' : 'Upload logo'}
              </Button>
              {profile.logoDataUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  btnSize="sm"
                  onClick={handleRemove}
                  aria-label="Remove logo"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          {/* allow-raw-html: hidden file picker — no shared primitive exists for file inputs (mirrors CsvImportModal/GcodeImport/BackupRestoreSection) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={e => { void handleFileSelect(e); }}
            className="hidden"
            aria-label="Choose logo image file"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Add your logo to PDF quotes and hosted quote pages — no more &quot;Made with 3DCoster&quot; footer.
          </p>
          <Button
            type="button"
            variant="secondary"
            btnSize="sm"
            onClick={onOpenPitch}
            aria-label="Add your logo (Pro feature)"
          >
            Add your logo
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-blue-600/30 text-blue-300 rounded">
              Pro
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}

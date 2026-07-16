import { Link } from 'react-router-dom';
import type { UserProfile, Currency } from '../types';
import { CURRENCY_CONFIG } from '../utils/currency';
import { Input, Select, Textarea, SidePanel, Button } from './ui';
import { useProAuth } from '../hooks/useProAuth';
import { BillingPanel } from './pro/BillingPanel';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  /** Opens the Pro magic-link SignInModal (App.tsx owns that state — D-09). */
  onOpenSignIn: () => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  userProfile,
  onProfileChange,
  onOpenSignIn,
}: UserProfileModalProps) {
  const userCurrency = userProfile.currency;
  // Phase 43-03 (PRO-01/D-09): account state for the Account & Pro section
  // below. Safe to call unconditionally — the hook is a no-op when the
  // Supabase client is null (Tauri desktop, or unconfigured web build).
  const { user, isSignedIn, signOut } = useProAuth();

  return (
    <SidePanel isOpen={isOpen} onClose={onClose} title="Profile" size="md">
      <div className="p-4 space-y-6">
          {/* Account & Pro (Phase 43-03, D-09: account/billing status lives in
              the existing profile area — no new chrome anywhere else). Web
              only: the Tauri desktop build renders no Pro/auth UI at all
              (D-12), so this whole section is compiled out under __IS_TAURI__. */}
          {!__IS_TAURI__ && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">Account &amp; Pro</h3>
              {isSignedIn ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{user?.email}</p>
                      <p className="text-xs text-slate-500">Signed in</p>
                    </div>
                    <Button
                      variant="secondary"
                      btnSize="sm"
                      onClick={() => void signOut()}
                      aria-label="Sign out of your Pro account"
                    >
                      Sign out
                    </Button>
                  </div>
                  {/* Billing panel (Phase 43-06, PRO-04): subscribe / status /
                      cancel via Paddle MoR. Self-gates on __IS_TAURI__ too. */}
                  <BillingPanel />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    The calculator is free forever — an account is only needed
                    for Pro features like hosted quote pages.
                  </p>
                  <Button
                    variant="primary"
                    btnSize="sm"
                    onClick={onOpenSignIn}
                    aria-label="Sign in for Pro"
                  >
                    Sign in for Pro
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Profile</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name (optional)</label>
                <Input
                  type="text"
                  value={userProfile.name || ''}
                  onChange={e => onProfileChange({ ...userProfile, name: e.target.value || undefined })}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Currency</label>
                <Select
                  value={userCurrency}
                  onChange={e => {
                    const currency = e.target.value as Currency;
                    const config = CURRENCY_CONFIG[currency];
                    onProfileChange({
                      ...userProfile,
                      currency,
                      address: {
                        ...userProfile.address,
                        country: config.country,
                      },
                    });
                  }}
                >
                  {Object.entries(CURRENCY_CONFIG).map(([code, config]) => (
                    <option key={code} value={code}>
                      {code} - {config.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  Filament prices will show only your currency.
                </p>
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Your Address</h3>
            <p className="text-xs text-slate-500 mb-3">
              Used to determine available shipping options.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Street Address</label>
                <Input
                  type="text"
                  value={userProfile.address?.street || ''}
                  onChange={e => onProfileChange({
                    ...userProfile,
                    address: { ...userProfile.address, street: e.target.value || undefined, country: userProfile.address?.country || CURRENCY_CONFIG[userCurrency].country },
                  })}
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">City</label>
                  <Input
                    type="text"
                    value={userProfile.address?.city || ''}
                    onChange={e => onProfileChange({
                      ...userProfile,
                      address: { ...userProfile.address, city: e.target.value || undefined, country: userProfile.address?.country || CURRENCY_CONFIG[userCurrency].country },
                    })}
                    placeholder="Toronto"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Province/State/Region</label>
                  <Input
                    type="text"
                    value={userProfile.address?.province || ''}
                    onChange={e => onProfileChange({
                      ...userProfile,
                      address: { ...userProfile.address, province: e.target.value || undefined, country: userProfile.address?.country || CURRENCY_CONFIG[userCurrency].country },
                    })}
                    placeholder="ON"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Postal/ZIP Code</label>
                  <Input
                    type="text"
                    value={userProfile.address?.postalCode || ''}
                    onChange={e => onProfileChange({
                      ...userProfile,
                      address: { ...userProfile.address, postalCode: e.target.value || undefined, country: userProfile.address?.country || CURRENCY_CONFIG[userCurrency].country },
                    })}
                    placeholder="M5V 1A1"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Country</label>
                  <Input
                    type="text"
                    value={CURRENCY_CONFIG[userCurrency].countryName}
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Default Quote Terms (Phase 16 D-09) */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Default Quote Terms</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Default quote terms (optional)</label>
              <Textarea
                rows={4}
                value={userProfile.defaultTerms || ''}
                onChange={e => onProfileChange({ ...userProfile, defaultTerms: e.target.value || undefined })}
                placeholder="e.g. Payment due within 14 days. All sales final."
              />
              <p className="text-xs text-slate-500 mt-1">Added to the Terms section of every PDF quote.</p>
            </div>
          </div>

          {/* Feedback Link */}
          <div className="pt-4 border-t border-slate-700">
            <Link
              to="/feedback"
              className="flex items-center justify-center gap-2 w-full py-3 text-slate-400 hover:text-blue-400 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Send Feedback
            </Link>
          </div>
        </div>
    </SidePanel>
  );
}

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { UserProfile, Currency, ShippingConfig } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  shippingConfig: ShippingConfig;
  onProfileChange: (profile: UserProfile) => void;
  onShippingChange: (config: ShippingConfig) => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  userProfile,
  shippingConfig,
  onProfileChange,
  onShippingChange,
}: UserProfileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const userCurrency = userProfile.currency;

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-end p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md mt-12 mr-2 max-h-[calc(100vh-100px)] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">User Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Profile</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={userProfile.name || ''}
                  onChange={e => onProfileChange({ ...userProfile, name: e.target.value || undefined })}
                  placeholder="Your name"
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Currency</label>
                <select
                  value={userCurrency}
                  onChange={e => {
                    const currency = e.target.value as Currency;
                    onProfileChange({
                      ...userProfile,
                      currency,
                      address: {
                        ...userProfile.address,
                        country: currency === 'CAD' ? 'CA' : 'US',
                      },
                    });
                  }}
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="USD">USD - US Dollar</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Filament prices will show only your currency.
                </p>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Your Hourly Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={userProfile.laborHourlyRate || ''}
                  onChange={e => onProfileChange({ ...userProfile, laborHourlyRate: parseFloat(e.target.value) || 0 })}
                  placeholder="20"
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Value your time! Includes prep, monitoring, and post-processing.
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
                <input
                  type="text"
                  value={userProfile.address?.street || ''}
                  onChange={e => onProfileChange({
                    ...userProfile,
                    address: { ...userProfile.address, street: e.target.value || undefined, country: userProfile.address?.country || (userCurrency === 'CAD' ? 'CA' : 'US') },
                  })}
                  placeholder="123 Main St"
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    value={userProfile.address?.city || ''}
                    onChange={e => onProfileChange({
                      ...userProfile,
                      address: { ...userProfile.address, city: e.target.value || undefined, country: userProfile.address?.country || (userCurrency === 'CAD' ? 'CA' : 'US') },
                    })}
                    placeholder="Toronto"
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{userCurrency === 'CAD' ? 'Province' : 'State'}</label>
                  <input
                    type="text"
                    value={userProfile.address?.province || ''}
                    onChange={e => onProfileChange({
                      ...userProfile,
                      address: { ...userProfile.address, province: e.target.value || undefined, country: userProfile.address?.country || (userCurrency === 'CAD' ? 'CA' : 'US') },
                    })}
                    placeholder={userCurrency === 'CAD' ? 'ON' : 'CA'}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{userCurrency === 'CAD' ? 'Postal Code' : 'ZIP Code'}</label>
                  <input
                    type="text"
                    value={userProfile.address?.postalCode || ''}
                    onChange={e => onProfileChange({
                      ...userProfile,
                      address: { ...userProfile.address, postalCode: e.target.value || undefined, country: userProfile.address?.country || (userCurrency === 'CAD' ? 'CA' : 'US') },
                    })}
                    placeholder={userCurrency === 'CAD' ? 'M5V 1A1' : '90210'}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Country</label>
                  <input
                    type="text"
                    value={userProfile.address?.country === 'CA' ? 'Canada' : 'United States'}
                    disabled
                    className="w-full bg-slate-600 text-slate-400 text-sm px-3 py-2 rounded-lg border-0 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Local Delivery Settings (CAD only) */}
          {userCurrency === 'CAD' && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">Local Pickup & Dropoff</h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Delivery Radius (km)</label>
                  <input
                    type="number"
                    value={shippingConfig.maxDeliveryRadiusKm}
                    onChange={e => onShippingChange({ ...shippingConfig, maxDeliveryRadiusKm: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Gas Price ($/L)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={shippingConfig.gasPricePerLiter}
                      onChange={e => onShippingChange({ ...shippingConfig, gasPricePerLiter: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Fuel (L/100km)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={shippingConfig.vehicleFuelEfficiency}
                      onChange={e => onShippingChange({ ...shippingConfig, vehicleFuelEfficiency: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Dropoff cost = (distance × 2) × (L/100km) × gas price
                </p>
              </div>
            </div>
          )}

          {/* Carrier Rates */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Default Carrier Rates</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">UPS ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={shippingConfig.upsBaseCost}
                  onChange={e => onShippingChange({ ...shippingConfig, upsBaseCost: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">FedEx ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={shippingConfig.fedexBaseCost}
                  onChange={e => onShippingChange({ ...shippingConfig, fedexBaseCost: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {userCurrency === 'CAD' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Purolator ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={shippingConfig.purolatorBaseCost}
                    onChange={e => onShippingChange({ ...shippingConfig, purolatorBaseCost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              {userCurrency === 'USD' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">USPS ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={shippingConfig.uspsBaseCost}
                    onChange={e => onShippingChange({ ...shippingConfig, uspsBaseCost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              You can override per order in the calculator.
            </p>
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
      </div>
    </div>
  );
}

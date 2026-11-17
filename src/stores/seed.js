// Starting values for a brand-new store. Nothing here is sample data:
// the store profile is filled in during first-run setup and in Settings.
export const DEFAULT_SETTINGS = {
  storeName: '',
  address: '',
  phone: '',
  email: '',
  taxId: '',
  currency: 'USD',
  taxRate: 0,
  taxInclusive: false,
  lowStockThreshold: 5,
  requireShift: true,
  defaultFloat: 0,
  loyaltyEnabled: true,
  pointsPerUnit: 1,
  pointValue: 0.01,
  tierSilver: 0, // lifetime spend for Silver; 0 = tiers off
  tierGold: 0, // lifetime spend for Gold; 0 = tiers off
  receiptHeader: 'Thank you for your purchase!',
  receiptFooter: '',
  theme: 'light',
  accent: 'aurora',
}

/** An empty store. `admin` is the first account (created during setup); without it the app asks for setup. */
export function createBlank(settings = {}, admin = null) {
  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    categories: [],
    products: [],
    customers: [],
    staff: admin ? [{ ...admin }] : [],
    orders: [],
    held: [],
    shifts: [],
    counters: { order: 1000 },
    session: { userId: admin ? admin.id : null },
    cart: null,
  }
}

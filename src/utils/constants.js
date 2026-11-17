// Every worker sees only what their job needs. The manager is the shop owner's role.
export const ROLES = {
  manager: {
    label: 'Manager',
    color: '#7c5cff',
    duty: 'Runs the business: everything, including the team and settings.',
    perms: ['dashboard', 'register', 'orders', 'refund', 'products', 'customers', 'reports', 'shifts', 'staff', 'settings'],
  },
  supervisor: {
    label: 'Supervisor',
    color: '#0ea5e9',
    duty: 'Runs the floor: sells, refunds, customers and cash shifts.',
    perms: ['dashboard', 'register', 'orders', 'refund', 'customers', 'shifts'],
  },
  cashier: {
    label: 'Cashier',
    color: '#ec4899',
    duty: 'Sells at the register and sees only their own sales.',
    perms: ['register', 'ordersOwn'],
  },
  procurement: {
    label: 'Procurement',
    color: '#f59e0b',
    duty: 'Buys and receives stock: products, prices, stock levels.',
    perms: ['products'],
  },
  accountant: {
    label: 'Accountant',
    color: '#10b981',
    duty: 'Checks the money: sales, reports and cash reconciliation (read-only).',
    perms: ['dashboard', 'orders', 'reports', 'shiftsView'],
  },
  support: {
    label: 'Customer service',
    color: '#6366f1',
    duty: 'Looks after customers and loyalty, and looks up their orders.',
    perms: ['customers', 'orders'],
  },
}
export const ROLE_ORDER = ['manager', 'supervisor', 'cashier', 'procurement', 'accountant', 'support']
/** Roles saved by older versions of the app, mapped to today's roles. */
export const LEGACY_ROLES = { admin: 'manager' }

export const PERMISSIONS = [
  { id: 'dashboard', label: 'See the business dashboard' },
  { id: 'register', label: 'Sell at the register' },
  { id: 'ordersOwn', label: 'See their own sales' },
  { id: 'orders', label: 'See all orders' },
  { id: 'refund', label: 'Issue refunds' },
  { id: 'customers', label: 'Manage customers & loyalty' },
  { id: 'shifts', label: 'Open & close cash shifts' },
  { id: 'shiftsView', label: 'View cash shifts (read-only)' },
  { id: 'products', label: 'Manage products & stock' },
  { id: 'reports', label: 'View reports & profit' },
  { id: 'staff', label: 'Manage the team & PINs' },
  { id: 'settings', label: 'Change business settings' },
]

export const BUSINESS_TYPES = [
  'Retail shop', 'Supermarket / mini-mart', 'Restaurant / café', 'Bar / lounge', 'Pharmacy', 'Hardware store',
  'Boutique / fashion', 'Electronics', 'Beauty / salon', 'Bakery', 'Butchery', 'Bookshop / stationery', 'Other',
]

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', color: '#22c55e' },
  { id: 'card', label: 'Card', color: '#8b5cf6' },
  { id: 'mobile', label: 'Mobile', color: '#22d3ee' },
]
export const paymentLabel = (id) => PAYMENT_METHODS.find((m) => m.id === id)?.label || id

export const CURRENCIES = [
  ['USD', 'US Dollar'],
  ['EUR', 'Euro'],
  ['GBP', 'British Pound'],
  ['CAD', 'Canadian Dollar'],
  ['AUD', 'Australian Dollar'],
  ['KES', 'Kenyan Shilling'],
  ['UGX', 'Ugandan Shilling'],
  ['TZS', 'Tanzanian Shilling'],
  ['RWF', 'Rwandan Franc'],
  ['NGN', 'Nigerian Naira'],
  ['GHS', 'Ghanaian Cedi'],
  ['ZAR', 'South African Rand'],
  ['INR', 'Indian Rupee'],
  ['AED', 'UAE Dirham'],
  ['JPY', 'Japanese Yen'],
]

export const ACCENTS = [
  { id: 'aurora', label: 'Aurora', colors: ['#7c5cff', '#4f7dff', '#22d3ee'] },
  { id: 'sunset', label: 'Sunset', colors: ['#f43f7a', '#ff6a4d', '#ffb23f'] },
  { id: 'emerald', label: 'Emerald', colors: ['#059669', '#10b981', '#a3e635'] },
  { id: 'ocean', label: 'Ocean', colors: ['#2563eb', '#0ea5e9', '#2dd4bf'] },
]

export const SWATCHES = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e',
  '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#d946ef',
]

export const DENOMS = {
  USD: [100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01],
  CAD: [100, 50, 20, 10, 5, 2, 1, 0.25, 0.1, 0.05],
  AUD: [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1],
  EUR: [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1],
  GBP: [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1],
  KES: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  UGX: [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100],
  TZS: [10000, 5000, 2000, 1000, 500, 200, 100],
  RWF: [5000, 2000, 1000, 500, 100, 50],
  NGN: [1000, 500, 200, 100, 50, 20, 10, 5],
  GHS: [200, 100, 50, 20, 10, 5, 2, 1],
  ZAR: [200, 100, 50, 20, 10, 5, 2, 1],
  INR: [500, 200, 100, 50, 20, 10, 5, 2, 1],
  AED: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  JPY: [10000, 5000, 1000, 500, 100, 50, 10],
}

/** Quick opening-float amounts sized to the currency's banknotes (plus the store's default float). */
export function floatPresets(currency, defaultFloat = 0) {
  const d = DENOMS[currency] || DENOMS.USD
  const base = d[Math.min(2, d.length - 1)] // e.g. 20 USD, 50 EUR, 10,000 UGX
  const set = new Set([0, Number(defaultFloat) || 0, base * 5, base * 10, base * 20])
  return [...set].sort((a, b) => a - b)
}

export const REFUND_REASONS = ['Customer request', 'Damaged / defective item', 'Wrong item served', 'Pricing error', 'Other']

import { createRouter, createWebHashHistory } from 'vue-router'
import { LayoutDashboard, ShoppingCart, ReceiptText, Package, Users, ChartColumn, UserCog, Clock, Settings } from '@lucide/vue'
import { usePos } from '@/stores/pos'

// `perm` may be a list: the item shows when the worker has any of them.
export const NAV = [
  { name: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard' },
  { name: 'register', path: '/register', label: 'Register', icon: ShoppingCart, perm: 'register' },
  { name: 'orders', path: '/orders', label: 'Orders', icon: ReceiptText, perm: ['orders', 'ordersOwn'] },
  { name: 'products', path: '/products', label: 'Inventory', icon: Package, perm: 'products' },
  { name: 'customers', path: '/customers', label: 'Customers', icon: Users, perm: 'customers' },
  { name: 'reports', path: '/reports', label: 'Reports', icon: ChartColumn, perm: 'reports' },
  { name: 'shifts', path: '/shifts', label: 'Cash & Shifts', icon: Clock, perm: ['shifts', 'shiftsView'] },
  { name: 'staff', path: '/staff', label: 'Team', icon: UserCog, perm: 'staff' },
  { name: 'settings', path: '/settings', label: 'Settings', icon: Settings, perm: 'settings' },
]

/** The first screen a worker is allowed to use: Dashboard for managers, Register for cashiers, and so on. */
export function homeFor(pos) {
  const item = NAV.find((n) => pos.can(n.perm))
  return item ? { path: item.path } : { name: 'login' }
}

const routes = [
  { path: '/welcome', name: 'landing', component: () => import('@/views/LandingView.vue'), meta: { public: true, landing: true, title: 'Point of sale for growing businesses' } },
  { path: '/signup', name: 'signup', component: () => import('@/views/SignupView.vue'), meta: { public: true, guest: true, title: 'Create your business' } },
  { path: '/signin', redirect: '/login' },
  { path: '/setup', name: 'setup', component: () => import('@/views/SetupView.vue'), meta: { public: true, setup: true, title: 'Create a manager' } },
  { path: '/suspended', name: 'suspended', component: () => import('@/views/SuspendedView.vue'), meta: { public: true, title: 'Account on hold' } },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true, title: 'Sign in' } },
  { path: '/admin2026', name: 'admin', component: () => import('@/views/AdminView.vue'), meta: { public: true, admin: true, title: 'Platform admin' } },
  { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { perm: 'dashboard', title: 'Dashboard' } },
  { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { perm: 'register', title: 'Register', full: true } },
  { path: '/orders', name: 'orders', component: () => import('@/views/OrdersView.vue'), meta: { perm: ['orders', 'ordersOwn'], title: 'Orders' } },
  { path: '/products', name: 'products', component: () => import('@/views/ProductsView.vue'), meta: { perm: 'products', title: 'Inventory' } },
  { path: '/customers', name: 'customers', component: () => import('@/views/CustomersView.vue'), meta: { perm: 'customers', title: 'Customers' } },
  { path: '/reports', name: 'reports', component: () => import('@/views/ReportsView.vue'), meta: { perm: 'reports', title: 'Reports' } },
  { path: '/shifts', name: 'shifts', component: () => import('@/views/ShiftsView.vue'), meta: { perm: ['shifts', 'shiftsView'], title: 'Cash & Shifts' } },
  { path: '/staff', name: 'staff', component: () => import('@/views/StaffView.vue'), meta: { perm: 'staff', title: 'Team' } },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { perm: 'settings', title: 'Settings' } },
  { path: '/:pathMatch(.*)*', name: 'notfound', component: () => import('@/views/NotFoundView.vue'), meta: { title: 'Not found' } },
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to) => {
  const pos = usePos()
  if (to.meta.admin || to.meta.landing) return true // platform admin and marketing pages stand alone

  // 1. the device must belong to a business (the login page links it, the sign-up page creates one)
  if (!pos.signedIn) return to.meta.guest || to.name === 'login' ? true : to.fullPath === '/' ? { name: 'landing' } : { name: 'login' }
  if (to.meta.guest) return pos.currentUser ? homeFor(pos) : { name: 'login' }

  // 2. a suspended business can only see the notice
  if (pos.suspended) return to.name === 'suspended' ? true : { name: 'suspended' }
  if (to.name === 'suspended') return pos.currentUser ? homeFor(pos) : { name: 'login' }

  // 3. a business needs at least one manager
  if (to.meta.setup) return pos.needsSetup ? true : pos.currentUser ? homeFor(pos) : { name: 'login' }
  if (pos.needsSetup) return { name: 'setup' }

  // 4. workers sign in with their PIN and only reach their own screens
  if (to.meta.public) return pos.currentUser ? homeFor(pos) : true
  if (!pos.currentUser) return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  if (to.meta.perm && !pos.can(to.meta.perm)) return homeFor(pos)
  return true
})

router.afterEach((to) => {
  document.title = `${to.meta.title || 'Point of sale'} · Maynex POS`
})

export default router

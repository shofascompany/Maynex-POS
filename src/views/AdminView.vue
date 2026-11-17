<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  LayoutDashboard, Store, Megaphone, ShieldCheck, LogOut, Search, ArrowLeft, PauseCircle, PlayCircle, Trash2,
  Building2, Users, ReceiptText, Wallet, Sparkles, Mail, Lock, Server, RefreshCw, UserPlus, X, Check, ArrowRight,
} from '@lucide/vue'
import { useAdmin } from '@/stores/admin'
import { toast, confirm } from '@/composables'
import { ROLES, ROLE_ORDER, CURRENCIES, BUSINESS_TYPES } from '@/utils/constants'
import { formatMoney, formatDate, timeAgo, initials } from '@/utils/format'
import BrandMark from '@/components/BrandMark.vue'
import Wordmark from '@/components/Wordmark.vue'
import BaseModal from '@/components/BaseModal.vue'
import RecordTable from '@/components/admin/RecordTable.vue'

const admin = useAdmin()
onMounted(() => admin.init())

// ---------- access ----------
const login = ref({ email: '', password: '' })
const busy = ref(false)
async function signIn() {
  busy.value = true
  try {
    await admin.signIn(login.value.email, login.value.password)
    login.value.password = ''
    await loadAll()
  } catch (e) {
    toast(e.message, 'error', 5000)
  } finally {
    busy.value = false
  }
}
const server = ref({ url: '', key: '' })
async function connectServer() {
  try {
    await admin.saveProject(server.value.url, server.value.key)
    toast('Server connected on this device')
  } catch (e) {
    toast(e.message, 'error', 5000)
  }
}
async function signOut() {
  await admin.signOut()
  selected.value = null
}

// ---------- data ----------
const tab = ref('overview')
const businesses = ref([])
const loading = ref(false)
async function loadAll() {
  if (!admin.isAdmin) return
  loading.value = true
  try {
    businesses.value = await admin.overview()
  } catch (e) {
    toast(e.message, 'error', 5000)
  } finally {
    loading.value = false
  }
}
watch(() => admin.isAdmin, (v) => v && loadAll(), { immediate: true })

const money = (v, cur) => formatMoney(v, cur || 'USD')
const stats = computed(() => {
  const list = businesses.value
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const byCurrency = {}
  for (const b of list) byCurrency[b.currency] = (byCurrency[b.currency] || 0) + Number(b.revenue || 0)
  return {
    total: list.length,
    active: list.filter((b) => b.status === 'active').length,
    suspended: list.filter((b) => b.status === 'suspended').length,
    newMonth: list.filter((b) => new Date(b.created_at) >= monthStart).length,
    orders: list.reduce((s, b) => s + Number(b.order_count || 0), 0),
    staff: list.reduce((s, b) => s + Number(b.staff_count || 0), 0),
    revenue: Object.entries(byCurrency).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]),
    newest: [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    busiest: [...list].sort((a, b) => Number(b.order_count) - Number(a.order_count)).filter((b) => Number(b.order_count) > 0).slice(0, 5),
  }
})

// ---------- businesses list ----------
const q = ref('')
const statusF = ref('all')
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  return businesses.value.filter((b) => {
    if (statusF.value !== 'all' && b.status !== statusF.value) return false
    if (!s) return true
    return [b.name, b.owner_email, b.city, b.country, b.business_type, b.phone].some((x) => (x || '').toLowerCase().includes(s))
  })
})

// ---------- business detail ----------
const selected = ref(null)
const dtab = ref('profile')
const profile = ref({})
const settings = ref({})
const categories = ref([])
const savingProfile = ref(false)
async function openBusiness(b) {
  selected.value = b
  dtab.value = 'profile'
  tab.value = 'businesses'
  profile.value = { name: b.name, business_type: b.business_type || '', country: b.country || '', city: b.city || '', phone: b.phone || '', currency: b.currency }
  try {
    settings.value = await admin.getSettings(b.id)
    await loadCategories()
  } catch (e) {
    toast(e.message, 'error', 5000)
  }
}
async function loadCategories() {
  if (selected.value) categories.value = await admin.rows('categories', selected.value.id)
}
async function saveProfile() {
  if (!profile.value.name?.trim()) return toast('The business needs a name', 'warning')
  savingProfile.value = true
  try {
    const b = await admin.updateBusiness(selected.value.id, { ...profile.value, name: profile.value.name.trim() })
    const data = { ...settings.value, storeName: b.name, phone: b.phone || '', currency: b.currency, taxRate: Number(settings.value.taxRate) || 0 }
    await admin.saveSettings(selected.value.id, data)
    settings.value = data
    Object.assign(selected.value, b)
    toast('Business updated. Its devices update automatically.')
  } catch (e) {
    toast(e.message, 'error', 5000)
  } finally {
    savingProfile.value = false
  }
}

const showSuspend = ref(false)
const suspendReason = ref('')
async function suspend() {
  try {
    const b = await admin.updateBusiness(selected.value.id, { status: 'suspended', suspended_reason: suspendReason.value.trim() || null })
    Object.assign(selected.value, b)
    showSuspend.value = false
    toast(`${b.name} is on hold. Its devices stop selling right away.`, 'info')
  } catch (e) {
    toast(e.message, 'error', 5000)
  }
}
async function reactivate() {
  try {
    const b = await admin.updateBusiness(selected.value.id, { status: 'active', suspended_reason: null })
    Object.assign(selected.value, b)
    toast(`${b.name} is active again`)
  } catch (e) {
    toast(e.message, 'error', 5000)
  }
}
const showDelete = ref(false)
const deleteName = ref('')
async function removeBusiness() {
  try {
    await admin.deleteBusiness(selected.value.id)
    toast(`${selected.value.name} and all its data were deleted`, 'info')
    businesses.value = businesses.value.filter((x) => x.id !== selected.value.id)
    selected.value = null
    showDelete.value = false
  } catch (e) {
    toast(e.message, 'error', 5000)
  }
}

// field definitions for the record tables (database column names)
const cur = computed(() => selected.value?.currency || 'USD')
const fmtMoney = (v) => money(v, cur.value)
const roleOptions = ROLE_ORDER.map((r) => ({ value: r, label: ROLES[r].label }))
const catOptions = computed(() => [{ value: null, label: 'Uncategorized' }, ...categories.value.map((c) => ({ value: c.id, label: c.name }))])
const staffName = (id) => id || '—'
const F = computed(() => ({
  staff: [
    { key: 'name', label: 'Name', list: true, required: true },
    { key: 'username', label: 'Username', list: true, required: true },
    { key: 'role', label: 'Role', type: 'select', options: roleOptions, list: true, required: true },
    { key: 'pin', label: 'PIN (4 digits)', required: true, maxlength: 4 },
    { key: 'active', label: 'Active (can sign in)', type: 'bool', list: true },
    { key: 'owner', label: 'Business owner profile', type: 'bool' },
  ],
  products: [
    { key: 'name', label: 'Name', list: true, required: true },
    { key: 'category_id', label: 'Category', type: 'select', options: catOptions.value, list: true },
    { key: 'price', label: 'Price', type: 'number', step: '0.01', list: true, required: true, format: fmtMoney },
    { key: 'cost', label: 'Cost', type: 'number', step: '0.01', format: fmtMoney },
    { key: 'stock', label: 'Stock', type: 'number', step: '1', list: true },
    { key: 'track_stock', label: 'Track stock', type: 'bool' },
    { key: 'active', label: 'On sale', type: 'bool', list: true },
    { key: 'sku', label: 'SKU' },
    { key: 'barcode', label: 'Barcode', list: true },
    { key: 'icon', label: 'Icon name' },
  ],
  categories: [
    { key: 'name', label: 'Name', list: true, required: true },
    { key: 'icon', label: 'Icon name', list: true },
    { key: 'color', label: 'Colour (hex)', list: true },
  ],
  customers: [
    { key: 'name', label: 'Name', list: true, required: true },
    { key: 'phone', label: 'Phone', list: true },
    { key: 'email', label: 'Email', list: true },
    { key: 'points', label: 'Points', type: 'number', step: '1', list: true },
    { key: 'total_spent', label: 'Total spent', type: 'number', step: '0.01', list: true, format: fmtMoney },
    { key: 'visits', label: 'Visits', type: 'number', step: '1' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  orders: [
    { key: 'number', label: 'Order', readonly: true, list: true, format: (v) => `#${v}` },
    { key: 'created_at', label: 'Date', type: 'datetime', readonly: true, list: true },
    { key: 'total', label: 'Total', type: 'number', readonly: true, list: true, format: fmtMoney },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'completed', label: 'Paid' }, { value: 'refunded', label: 'Refunded' }], list: true },
    { key: 'staff_id', label: 'Staff id', readonly: true, format: staffName },
    { key: 'note', label: 'Note', type: 'textarea' },
    { key: 'items', label: 'Items', type: 'json', readonly: true, list: true },
    { key: 'payments', label: 'Payments', type: 'json', readonly: true },
  ],
  shifts: [
    { key: 'opened_at', label: 'Opened', type: 'datetime', readonly: true, list: true },
    { key: 'closed_at', label: 'Closed', type: 'datetime', readonly: true, list: true, format: (v) => (v ? new Date(v).toLocaleString() : 'Open') },
    { key: 'opening_float', label: 'Float', type: 'number', readonly: true, list: true, format: fmtMoney },
    { key: 'expected', label: 'Expected', type: 'number', readonly: true, format: fmtMoney },
    { key: 'counted', label: 'Counted', type: 'number', readonly: true, list: true, format: fmtMoney },
    { key: 'difference', label: 'Difference', type: 'number', readonly: true, list: true, format: fmtMoney },
    { key: 'note', label: 'Note', type: 'textarea' },
  ],
}))
const dtabs = [
  { id: 'profile', label: 'Profile' }, { id: 'staff', label: 'Team' }, { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' }, { id: 'customers', label: 'Customers' }, { id: 'orders', label: 'Orders' }, { id: 'shifts', label: 'Shifts' },
]

// ---------- platform ----------
const platform = ref(null)
const savingPlatform = ref(false)
async function loadPlatform() {
  try {
    platform.value = await admin.getPlatform()
  } catch (e) {
    toast(e.message, 'error', 5000)
  }
}
async function savePlatform() {
  savingPlatform.value = true
  try {
    platform.value = await admin.savePlatform({
      allow_signups: platform.value.allow_signups, announcement: platform.value.announcement.trim(), announcement_tone: platform.value.announcement_tone,
    })
    toast('Platform settings saved. Shops see the notice right away.')
  } catch (e) {
    toast(e.message, 'error', 5000)
  } finally {
    savingPlatform.value = false
  }
}

// ---------- admins ----------
const admins = ref([])
const newAdmin = ref('')
async function loadAdmins() {
  try {
    admins.value = await admin.listAdmins()
  } catch (e) {
    toast(e.message, 'error', 5000)
  }
}
async function addAdmin() {
  if (!newAdmin.value.includes('@')) return toast('Enter the email of an existing account', 'warning')
  try {
    await admin.addAdmin(newAdmin.value)
    newAdmin.value = ''
    await loadAdmins()
    toast('Platform admin added')
  } catch (e) {
    toast(e.message, 'error', 6000)
  }
}
async function removeAdmin(a) {
  if (!(await confirm({ title: `Remove ${a.email}?`, message: 'They lose access to this admin page.', confirmText: 'Remove', danger: true }))) return
  try {
    await admin.removeAdmin(a.user_id)
    await loadAdmins()
  } catch (e) {
    toast(e.message, 'error', 6000)
  }
}

watch(tab, (t) => {
  if (t === 'platform' && !platform.value) loadPlatform()
  if (t === 'admins') loadAdmins()
  if (t !== 'businesses') selected.value = null
})

const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'businesses', label: 'Businesses', icon: Store },
  { id: 'platform', label: 'Platform', icon: Megaphone },
  { id: 'admins', label: 'Admins', icon: ShieldCheck },
]
</script>

<template>
  <div class="adm">
    <!-- ======== not ready / server / sign in ======== -->
    <div v-if="!admin.ready" class="gate"><span class="spinner big"></span></div>

    <div v-else-if="!admin.configured" class="gate">
      <form class="gate-card card" @submit.prevent="connectServer">
        <div class="gate-brand"><BrandMark :size="40" /><div><Wordmark :size="20" /><span class="tag">Platform admin</span></div></div>
        <h1><Server :size="20" /> Connect the server</h1>
        <p class="muted">Paste your Supabase Project URL and anon key (Project Settings → API). This saves them on this device only; for every device, put them in <code>.env</code>.</p>
        <label class="field"><span class="label">Project URL</span><input v-model="server.url" class="input" placeholder="https://xxxx.supabase.co" /></label>
        <label class="field"><span class="label">Anon / publishable key</span><input v-model="server.key" class="input mono" /></label>
        <button class="btn btn-primary btn-lg btn-block" type="submit">Connect</button>
      </form>
    </div>

    <div v-else-if="!admin.isAdmin" class="gate">
      <form class="gate-card card" @submit.prevent="signIn">
        <div class="gate-brand"><BrandMark :size="40" /><div><Wordmark :size="20" /><span class="tag">Platform admin</span></div></div>
        <h1>Admin sign in</h1>
        <p class="muted">Restricted to Maynex POS platform administrators.</p>
        <label class="field"><span class="label">Email</span><div class="input-icon"><Mail :size="16" /><input v-model="login.email" class="input input-lg" type="email" autocomplete="username" autofocus /></div></label>
        <label class="field"><span class="label">Password</span><div class="input-icon"><Lock :size="16" /><input v-model="login.password" class="input input-lg" type="password" autocomplete="current-password" /></div></label>
        <button class="btn btn-primary btn-lg btn-block" type="submit" :disabled="busy">{{ busy ? 'Checking…' : 'Sign in' }} <ArrowRight v-if="!busy" :size="17" /></button>
        <p class="muted tiny">First time? Create your login in Supabase → Authentication → Users, then add it to <code>platform_admins</code> (see <code>supabase/schema.sql</code>, step 3).</p>
      </form>
    </div>

    <!-- ======== admin console ======== -->
    <div v-else class="console">
      <aside class="side">
        <div class="side-brand"><BrandMark :size="36" /><div><Wordmark :size="18" /><span class="tag">Platform admin</span></div></div>
        <nav>
          <button v-for="n in nav" :key="n.id" :class="{ on: tab === n.id }" @click="tab = n.id"><component :is="n.icon" :size="18" /> {{ n.label }}
            <span v-if="n.id === 'businesses'" class="count">{{ businesses.length }}</span>
          </button>
        </nav>
        <div class="me">
          <div class="avatar" style="--s: 34px">{{ initials(admin.session?.user?.email || 'A') }}</div>
          <div class="me-text"><strong class="ellipsis">{{ admin.session?.user?.email }}</strong><small>Platform admin</small></div>
          <button class="icon-btn sm" title="Sign out" @click="signOut"><LogOut :size="15" /></button>
        </div>
      </aside>

      <main class="main-area">
        <!-- overview -->
        <section v-if="tab === 'overview'" class="page rise">
          <div class="page-head">
            <div><h1>Platform overview</h1><p>Every business on Maynex POS at a glance.</p></div>
            <button class="btn" :disabled="loading" @click="loadAll"><RefreshCw :size="15" :class="{ spinning: loading }" /> Refresh</button>
          </div>
          <div class="kpis">
            <div class="kpi card"><span class="k-ico" style="--t: #7c5cff"><Building2 :size="18" /></span><small>Businesses</small><b>{{ stats.total }}</b><em>{{ stats.active }} active · {{ stats.suspended }} on hold</em></div>
            <div class="kpi card"><span class="k-ico" style="--t: #0ea5e9"><Sparkles :size="18" /></span><small>New this month</small><b>{{ stats.newMonth }}</b><em>sign-ups since the 1st</em></div>
            <div class="kpi card"><span class="k-ico" style="--t: #ec4899"><ReceiptText :size="18" /></span><small>Paid orders</small><b>{{ stats.orders.toLocaleString() }}</b><em>across all businesses</em></div>
            <div class="kpi card"><span class="k-ico" style="--t: #10b981"><Users :size="18" /></span><small>Staff accounts</small><b>{{ stats.staff.toLocaleString() }}</b><em>all roles</em></div>
          </div>
          <div class="grid3">
            <div class="card card-pad">
              <div class="card-title"><Wallet :size="16" class="inline" /> Sales by currency</div>
              <div class="card-sub">Paid orders, all time. Currencies are never mixed.</div>
              <ul v-if="stats.revenue.length" class="list">
                <li v-for="[c, v] in stats.revenue" :key="c"><span class="badge">{{ c }}</span><b class="num">{{ money(v, c) }}</b></li>
              </ul>
              <div v-else class="empty small">No sales yet</div>
            </div>
            <div class="card card-pad">
              <div class="card-title">Newest businesses</div>
              <div class="card-sub">Latest sign-ups</div>
              <ul v-if="stats.newest.length" class="list">
                <li v-for="b in stats.newest" :key="b.id" class="clickable" @click="openBusiness(b)"><span class="ellipsis"><b>{{ b.name }}</b> <span class="muted small">· {{ b.city || b.country || '—' }}</span></span><span class="muted small">{{ timeAgo(new Date(b.created_at).getTime()) }}</span></li>
              </ul>
              <div v-else class="empty small">No businesses yet</div>
            </div>
            <div class="card card-pad">
              <div class="card-title">Most active</div>
              <div class="card-sub">By paid orders</div>
              <ul v-if="stats.busiest.length" class="list">
                <li v-for="b in stats.busiest" :key="b.id" class="clickable" @click="openBusiness(b)"><span class="ellipsis"><b>{{ b.name }}</b></span><span class="num">{{ Number(b.order_count).toLocaleString() }} orders</span></li>
              </ul>
              <div v-else class="empty small">No orders yet</div>
            </div>
          </div>
        </section>

        <!-- businesses list -->
        <section v-else-if="tab === 'businesses' && !selected" class="page rise">
          <div class="page-head">
            <div><h1>Businesses</h1><p>Search, inspect and manage every shop on the platform.</p></div>
            <button class="btn" :disabled="loading" @click="loadAll"><RefreshCw :size="15" :class="{ spinning: loading }" /> Refresh</button>
          </div>
          <div class="card">
            <div class="filters">
              <div class="input-icon grow" style="min-width: 220px"><Search :size="16" /><input v-model="q" class="input" placeholder="Name, owner email, city, phone…" /></div>
              <div class="segmented">
                <button v-for="s in [['all', 'All'], ['active', 'Active'], ['suspended', 'On hold']]" :key="s[0]" :class="{ active: statusF === s[0] }" @click="statusF = s[0]">{{ s[1] }}</button>
              </div>
            </div>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Business</th><th class="hide-sm">Owner</th><th class="hide-sm">Location</th><th class="right">Staff</th><th class="right hide-sm">Products</th><th class="right">Orders</th><th class="right">Sales</th><th class="hide-sm">Last sale</th><th>Status</th></tr></thead>
                <tbody>
                  <tr v-for="b in filtered" :key="b.id" class="clickable" @click="openBusiness(b)">
                    <td><div class="biz"><span class="biz-ico">{{ initials(b.name) }}</span><div><strong>{{ b.name }}</strong><span class="muted tiny">{{ b.business_type || '—' }} · since {{ formatDate(b.created_at) }}</span></div></div></td>
                    <td class="hide-sm">{{ b.owner_email || '—' }}</td>
                    <td class="hide-sm">{{ [b.city, b.country].filter(Boolean).join(', ') || '—' }}</td>
                    <td class="right num">{{ b.staff_count }}</td>
                    <td class="right num hide-sm">{{ b.product_count }}</td>
                    <td class="right num">{{ Number(b.order_count).toLocaleString() }}</td>
                    <td class="right num bold">{{ money(b.revenue, b.currency) }}</td>
                    <td class="hide-sm muted">{{ b.last_order_at ? timeAgo(new Date(b.last_order_at).getTime()) : 'Never' }}</td>
                    <td><span class="badge" :class="b.status === 'active' ? 'b-success' : 'b-warning'"><span class="dot"></span>{{ b.status === 'active' ? 'Active' : 'On hold' }}</span></td>
                  </tr>
                </tbody>
              </table>
              <div v-if="!filtered.length" class="empty"><strong>{{ businesses.length ? 'No businesses match' : 'No businesses yet' }}</strong><span class="small">{{ businesses.length ? 'Try another search or filter.' : 'Shops appear here as soon as owners sign up.' }}</span></div>
            </div>
          </div>
        </section>

        <!-- business detail -->
        <section v-else-if="tab === 'businesses' && selected" class="page rise">
          <button class="btn btn-ghost btn-sm back" @click="selected = null"><ArrowLeft :size="15" /> All businesses</button>
          <div class="detail-head card">
            <span class="biz-ico lg">{{ initials(selected.name) }}</span>
            <div class="grow">
              <h1>{{ selected.name }} <span class="badge" :class="selected.status === 'active' ? 'b-success' : 'b-warning'"><span class="dot"></span>{{ selected.status === 'active' ? 'Active' : 'On hold' }}</span></h1>
              <p class="muted">{{ selected.business_type || 'Business' }} · {{ [selected.city, selected.country].filter(Boolean).join(', ') || 'No location' }} · owner {{ selected.owner_email || '—' }} · since {{ formatDate(selected.created_at) }}</p>
              <p v-if="selected.status === 'suspended' && selected.suspended_reason" class="reason">On hold: {{ selected.suspended_reason }}</p>
            </div>
            <div class="row wrap">
              <button v-if="selected.status === 'active'" class="btn" @click="suspendReason = ''; showSuspend = true"><PauseCircle :size="16" /> Suspend</button>
              <button v-else class="btn btn-success" @click="reactivate"><PlayCircle :size="16" /> Reactivate</button>
              <button class="btn btn-danger" @click="deleteName = ''; showDelete = true"><Trash2 :size="16" /> Delete</button>
            </div>
          </div>
          <div class="segmented scroll mt">
            <button v-for="t in dtabs" :key="t.id" :class="{ active: dtab === t.id }" @click="dtab = t.id">{{ t.label }}</button>
          </div>

          <div v-if="dtab === 'profile'" class="card card-pad mt">
            <div class="form-grid">
              <label class="field span-2"><span class="label">Business name *</span><input v-model="profile.name" class="input" maxlength="80" /></label>
              <label class="field"><span class="label">Type</span><select v-model="profile.business_type" class="select"><option value="">—</option><option v-for="t in BUSINESS_TYPES" :key="t" :value="t">{{ t }}</option></select></label>
              <label class="field"><span class="label">Phone</span><input v-model="profile.phone" class="input" /></label>
              <label class="field"><span class="label">Country</span><input v-model="profile.country" class="input" /></label>
              <label class="field"><span class="label">City / town</span><input v-model="profile.city" class="input" /></label>
              <label class="field"><span class="label">Currency</span><select v-model="profile.currency" class="select"><option v-for="c in CURRENCIES" :key="c[0]" :value="c[0]">{{ c[0] }} · {{ c[1] }}</option></select></label>
              <label class="field"><span class="label">Sales tax (%)</span><input v-model.number="settings.taxRate" class="input" type="number" min="0" max="100" step="0.01" /></label>
              <label class="field span-2"><span class="label">Address (on receipts)</span><input v-model="settings.address" class="input" /></label>
              <label class="field"><span class="label">Receipt email</span><input v-model="settings.email" class="input" type="email" /></label>
              <label class="field"><span class="label">Low-stock alert at</span><input v-model.number="settings.lowStockThreshold" class="input" type="number" min="0" /></label>
              <label class="field span-2"><span class="label">Receipt thank-you line</span><input v-model="settings.receiptHeader" class="input" /></label>
              <label class="field span-2"><span class="label">Receipt footer</span><textarea v-model="settings.receiptFooter" class="textarea"></textarea></label>
            </div>
            <div class="row end mt"><button class="btn btn-primary" :disabled="savingProfile" @click="saveProfile"><Check :size="16" /> {{ savingProfile ? 'Saving…' : 'Save profile' }}</button></div>
          </div>
          <RecordTable v-else-if="dtab === 'staff'" :key="'s' + selected.id" class="mt" title="Team" table="staff" :bid="selected.id" :fields="F.staff" id-prefix="s_" :defaults="{ role: 'cashier', active: true, owner: false, pin: '', username: '' }" empty-text="No team members." />
          <RecordTable v-else-if="dtab === 'products'" :key="'p' + selected.id" class="mt" title="Products" table="products" :bid="selected.id" :fields="F.products" id-prefix="p_" :defaults="{ price: 0, cost: 0, stock: 0, track_stock: true, active: true, category_id: null }" empty-text="No products." />
          <RecordTable v-else-if="dtab === 'categories'" :key="'c' + selected.id" class="mt" title="Categories" table="categories" :bid="selected.id" :fields="F.categories" id-prefix="c_" :defaults="{ color: '#7c5cff', icon: 'tag' }" empty-text="No categories." @changed="loadCategories" />
          <RecordTable v-else-if="dtab === 'customers'" :key="'cu' + selected.id" class="mt" title="Customers" table="customers" :bid="selected.id" :fields="F.customers" id-prefix="cu_" :defaults="{ points: 0, total_spent: 0, visits: 0 }" empty-text="No customers." />
          <RecordTable v-else-if="dtab === 'orders'" :key="'o' + selected.id" class="mt" title="Orders" table="orders" :bid="selected.id" :fields="F.orders" :can-add="false" empty-text="No orders yet." />
          <RecordTable v-else-if="dtab === 'shifts'" :key="'sh' + selected.id" class="mt" title="Shifts" table="shifts" :bid="selected.id" :fields="F.shifts" order-by="opened_at" :can-add="false" empty-text="No shifts yet." />
        </section>

        <!-- platform -->
        <section v-else-if="tab === 'platform'" class="page rise">
          <div class="page-head"><div><h1>Platform</h1><p>Settings that apply to every business.</p></div></div>
          <div v-if="platform" class="stack">
            <div class="card card-pad">
              <div class="card-title">New businesses</div>
              <label class="switch mt"><input v-model="platform.allow_signups" type="checkbox" /><span class="track"></span>
                <div><strong>Allow new sign-ups</strong><span class="muted small block">When off, the sign-up page tells visitors to try again later. Existing businesses are unaffected.</span></div></label>
            </div>
            <div class="card card-pad">
              <div class="card-title">Notice to all businesses</div>
              <div class="card-sub">Shown at the top of every shop’s screens until dismissed. Leave empty to hide it.</div>
              <textarea v-model="platform.announcement" class="textarea mt" maxlength="240" placeholder="e.g. Scheduled maintenance on Sunday 02:00–03:00. Sales keep working offline."></textarea>
              <div class="segmented mt">
                <button v-for="t in ['info', 'success', 'warning', 'danger']" :key="t" :class="{ active: platform.announcement_tone === t }" @click="platform.announcement_tone = t">{{ t[0].toUpperCase() + t.slice(1) }}</button>
              </div>
              <div v-if="platform.announcement.trim()" class="preview" :class="platform.announcement_tone"><Megaphone :size="16" /> {{ platform.announcement }}</div>
            </div>
            <div class="row end"><button class="btn btn-primary" :disabled="savingPlatform" @click="savePlatform"><Check :size="16" /> {{ savingPlatform ? 'Saving…' : 'Save platform settings' }}</button></div>
          </div>
          <div v-else class="empty">Loading…</div>
        </section>

        <!-- admins -->
        <section v-else-if="tab === 'admins'" class="page rise">
          <div class="page-head"><div><h1>Platform admins</h1><p>People who can open this page and manage every business.</p></div></div>
          <div class="card">
            <div class="filters">
              <div class="input-icon grow"><UserPlus :size="16" /><input v-model="newAdmin" class="input" type="email" placeholder="Email of an existing account" @keydown.enter="addAdmin" /></div>
              <button class="btn btn-primary" @click="addAdmin">Add admin</button>
            </div>
            <ul class="admins">
              <li v-for="a in admins" :key="a.user_id">
                <div class="avatar" style="--s: 34px">{{ initials(a.email) }}</div>
                <div class="grow"><strong>{{ a.email }}</strong><span class="muted tiny block">Admin since {{ formatDate(a.created_at) }}</span></div>
                <span v-if="a.user_id === admin.session?.user?.id" class="badge b-primary">You</span>
                <button v-else class="icon-btn sm danger" title="Remove admin" @click="removeAdmin(a)"><X :size="14" /></button>
              </li>
            </ul>
            <p class="muted small pad">To add someone, they first need an account: create one in Supabase → Authentication → Users.</p>
          </div>
        </section>
      </main>
    </div>

    <BaseModal v-model:open="showSuspend" size="sm" title="Suspend this business?" :subtitle="selected?.name">
      <div class="stack">
        <p class="muted small">Its devices stop selling and editing immediately and show the reason below. Nothing is deleted; you can reactivate any time.</p>
        <label class="field"><span class="label">Reason shown to the business</span><textarea v-model="suspendReason" class="textarea" maxlength="200" placeholder="e.g. Subscription payment overdue"></textarea></label>
      </div>
      <template #footer>
        <button class="btn" @click="showSuspend = false">Cancel</button>
        <button class="btn btn-danger" @click="suspend"><PauseCircle :size="15" /> Suspend</button>
      </template>
    </BaseModal>

    <BaseModal v-model:open="showDelete" size="sm" title="Delete this business permanently?" :subtitle="selected?.name">
      <div class="stack">
        <p class="muted small">All of its products, customers, staff, orders and shifts are deleted from the server, and its devices are signed out. This cannot be undone.</p>
        <label class="field"><span class="label">Type <b>{{ selected?.name }}</b> to confirm</span><input v-model="deleteName" class="input" /></label>
      </div>
      <template #footer>
        <button class="btn" @click="showDelete = false">Cancel</button>
        <button class="btn btn-danger" :disabled="deleteName.trim() !== selected?.name" @click="removeBusiness"><Trash2 :size="15" /> Delete forever</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.adm { min-height: 100%; background: var(--bg); }
.gate { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; }
.gate-card { width: 100%; max-width: 420px; padding: 30px; border-radius: 24px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow); }
.gate-card h1 { display: flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 800; letter-spacing: -.02em; margin-top: 6px; }
.gate-brand, .side-brand { display: flex; align-items: center; gap: 12px; }
.gate-brand > div, .side-brand > div { display: flex; flex-direction: column; gap: 4px; }
.tag { align-self: flex-start; font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; padding: 3px 8px; border-radius: 99px; color: var(--accent-ink); background: color-mix(in srgb, var(--c1) 12%, transparent); }
code { font-family: var(--mono); font-size: 12px; padding: 1px 5px; border-radius: 5px; background: var(--surface-2); }

.console { display: grid; grid-template-columns: 250px minmax(0, 1fr); min-height: 100vh; }
.side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 18px; padding: 20px 14px; border-right: 1px solid var(--border); background: var(--bg-2); }
.side nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }
.side nav button { display: flex; align-items: center; gap: 12px; height: 42px; padding: 0 12px; border-radius: 12px; border: 0; background: none; font: 650 14px var(--font); color: var(--text-2); cursor: pointer; transition: all .2s var(--ease); }
.side nav button:hover { background: var(--surface-2); color: var(--text); }
.side nav button.on { color: #fff; background: var(--grad); box-shadow: 0 10px 22px -12px var(--c1); }
.count { margin-left: auto; font-size: 11px; font-weight: 800; padding: 1px 8px; border-radius: 99px; background: var(--surface-3); color: var(--text-2); }
.side nav button.on .count { background: rgba(255, 255, 255, .25); color: #fff; }
.me { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); }
.me-text { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.25; }
.me-text strong { font-size: 12.5px; }
.me-text small { color: var(--muted); font-size: 11.5px; }
.main-area { min-width: 0; padding: 26px 30px 40px; }

.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.kpi { display: flex; flex-direction: column; gap: 2px; padding: 18px; }
.kpi small { color: var(--muted); font-weight: 650; font-size: 12.5px; }
.kpi b { font-size: 28px; font-weight: 800; letter-spacing: -.03em; }
.kpi em { font-style: normal; font-size: 12px; color: var(--muted); }
.k-ico { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; margin-bottom: 8px; color: var(--t); background: color-mix(in srgb, var(--t) 13%, transparent); }
.grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
.list { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.list li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; background: var(--surface-2); min-width: 0; }
.list li.clickable { cursor: pointer; }
.list li.clickable:hover { background: var(--surface-3); }
.inline { display: inline; vertical-align: -3px; }
.block { display: block; }

.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 16px; border-bottom: 1px solid var(--border); }
.table-wrap { max-height: calc(100vh - 260px); }
.biz { display: flex; align-items: center; gap: 12px; }
.biz > div { display: flex; flex-direction: column; min-width: 0; }
.biz-ico { flex-shrink: 0; width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; font-weight: 800; font-size: 13px; color: #fff; background: var(--grad); }
.biz-ico.lg { width: 56px; height: 56px; border-radius: 16px; font-size: 18px; }
.back { margin-bottom: 10px; }
.detail-head { display: flex; align-items: center; gap: 16px; padding: 20px; flex-wrap: wrap; }
.detail-head h1 { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 800; letter-spacing: -.02em; flex-wrap: wrap; }
.detail-head p { margin-top: 2px; }
.reason { margin-top: 6px !important; color: var(--warning); font-weight: 650; font-size: 13px; }
.scroll { max-width: 100%; overflow-x: auto; }

.preview { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; border-radius: 12px; font-weight: 600; font-size: 13.5px; border: 1px solid var(--border-2); background: var(--bg-2); box-shadow: var(--shadow-sm); }
.preview svg { color: var(--info); }
.preview.success svg { color: var(--success); }
.preview.warning svg { color: var(--warning); }
.preview.danger svg { color: var(--danger); }
.admins { list-style: none; margin: 0; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.admins li { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 12px; }
.admins li:hover { background: var(--surface-2); }
.pad { padding: 0 16px 16px; }
.spinning { animation: spin 1s linear infinite; }
.spinner.big { width: 34px; height: 34px; border-radius: 50%; border: 3px solid var(--surface-3); border-top-color: var(--c1); animation: spin .8s linear infinite; }

@media (max-width: 1100px) {
  .kpis { grid-template-columns: repeat(2, 1fr); }
  .grid3 { grid-template-columns: 1fr; }
}
@media (max-width: 860px) {
  .console { grid-template-columns: 1fr; }
  .side { position: static; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center; border-right: 0; border-bottom: 1px solid var(--border); }
  .side nav { flex-direction: row; overflow-x: auto; flex-basis: 100%; order: 3; }
  .side nav button { white-space: nowrap; }
  .me { margin-left: auto; }
  .me-text { display: none; }
  .main-area { padding: 18px 16px 32px; }
}
</style>

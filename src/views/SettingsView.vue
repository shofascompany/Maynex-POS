<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Store, Percent, Star, Receipt, Palette, Database, Download, Upload, Trash2, Sun, Moon, Check, CloudCheck, MonitorDown, Share, Cloud, RefreshCw, LogOut, LogIn, Unplug } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useSync } from '@/stores/sync'
import { timeAgo } from '@/utils/format'
import { toast, confirm } from '@/composables'
import { canInstall, installed, isIOS, installApp } from '@/composables/pwa'
import { CURRENCIES, ACCENTS } from '@/utils/constants'
import { download, toDateInput, formatMoney } from '@/utils/format'
import ReceiptPaper from '@/components/ReceiptPaper.vue'

const pos = usePos()
const router = useRouter()
const s = computed(() => pos.settings)
const fileEl = ref(null)

const sections = [
  { id: 'store', label: 'Store profile', icon: Store },
  { id: 'sales', label: 'Sales & tax', icon: Percent },
  { id: 'loyalty', label: 'Loyalty', icon: Star },
  { id: 'receipt', label: 'Receipt', icon: Receipt },
  { id: 'look', label: 'Appearance', icon: Palette },
  { id: 'app', label: 'Install app', icon: MonitorDown },
  { id: 'account', label: 'Business account', icon: Cloud },
  { id: 'data', label: 'Data & backup', icon: Database },
]

const sync = useSync()
const login = ref({ password: '' })
const busy = ref(false)
const syncLabels = {
  disabled: 'Server not connected', connecting: 'Connecting…', 'signed-out': 'Offline: sign in to sync',
  syncing: 'Syncing…', synced: 'Up to date', error: 'Sync problem', suspended: 'On hold',
}
const syncTone = computed(() => ({ synced: 'b-success', syncing: 'b-info', connecting: 'b-info', error: 'b-danger', 'signed-out': 'b-warning' })[sync.status] || '')

async function run(fn, done) {
  busy.value = true
  try {
    await fn()
    if (done) toast(done)
  } catch (e) {
    toast(e.message || String(e), 'error', 5000)
  } finally {
    busy.value = false
  }
}
// re-connect the owner login on this device (e.g. after a password change elsewhere)
const reconnect = () =>
  run(async () => {
    await sync.signIn(pos.business?.email || sync.email, login.value.password)
    login.value.password = ''
  }, 'Reconnected. This device is syncing again.')
const syncNow = () => run(() => sync.syncNow(), 'Synced')
async function leave() {
  if (!(await confirm({
    title: `Sign this device out of ${pos.business?.name}?`,
    message: 'Unsynced changes are uploaded first. The business and its data stay safe on the server; signing in again downloads everything.',
    confirmText: 'Sign device out', danger: true,
  }))) return
  await run(() => sync.signOutBusiness(), 'This device is signed out')
  router.replace({ name: 'login' })
}

async function install() {
  if (await installApp()) toast('Maynex POS is installed. Open it from your home screen or app list.')
}
const activeSection = ref('store')
function go(id) {
  activeSection.value = id
  document.getElementById('set-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Preview uses your most recent sale; before the first sale it shows a clearly labelled example.
const lastOrder = computed(() => pos.orders.find((o) => o.status === 'completed') || null)
const sampleOrder = computed(() => {
  if (lastOrder.value) return lastOrder.value
  const items = [
    { name: 'Example item', price: 10, qty: 2, discount: 0, total: 20 },
    { name: 'Another item', price: 5, qty: 1, discount: 0, total: 5 },
  ]
  const subtotal = 25
  const rate = Number(s.value.taxRate) || 0
  const tax = s.value.taxInclusive ? +(subtotal - subtotal / (1 + rate / 100)).toFixed(2) : +((subtotal * rate) / 100).toFixed(2)
  const total = s.value.taxInclusive ? subtotal : +(subtotal + tax).toFixed(2)
  return {
    number: pos.counters.order + 1, createdAt: Date.now(), items, subtotal, discount: 0, tax, total,
    taxRate: rate, taxInclusive: s.value.taxInclusive,
    payments: [{ method: 'cash', amount: Math.ceil(total / 5) * 5 }], change: +(Math.ceil(total / 5) * 5 - total).toFixed(2),
    staffId: pos.currentUser?.id, customerId: null, status: 'completed', pointsEarned: 0, pointsRedeemed: 0,
  }
})

function exportBackup() {
  download(`maynex-backup-${toDateInput(Date.now())}.json`, pos.exportData(), 'application/json')
  toast('Backup downloaded')
}
function importBackup(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      if (!(await confirm({ title: 'Restore this backup?', message: 'Everything currently in Maynex POS on this device will be replaced.', confirmText: 'Restore', danger: true }))) return
      pos.importData(String(reader.result))
      toast('Backup restored')
      if (!pos.currentUser) router.replace({ name: 'login' })
    } catch (err) {
      toast(err.message || 'Could not read that file', 'error')
    } finally {
      e.target.value = ''
    }
  }
  reader.readAsText(file)
}
async function wipe() {
  if (!(await confirm({ title: 'Start from a clean slate?', message: 'Deletes every product, order, customer, shift and other team member. Only your account and settings remain.', confirmText: 'Erase everything', danger: true }))) return
  pos.clearAll()
  toast('All data cleared — ready for your own catalog', 'info')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Settings</h1>
        <p>Tune Maynex POS to the way your counter works.</p>
      </div>
      <span class="badge b-success saved"><CloudCheck :size="13" /> Changes save automatically</span>
    </div>

    <div class="layout">
      <nav class="side card">
        <button v-for="sec in sections" :key="sec.id" :class="{ on: activeSection === sec.id }" @click="go(sec.id)">
          <component :is="sec.icon" :size="17" /> {{ sec.label }}
        </button>
      </nav>

      <div class="sections">
        <section id="set-store" class="card card-pad rise">
          <div class="sec-head"><span class="sec-ico"><Store :size="18" /></span><div><h3>Store profile</h3><p class="muted small">Shown on receipts and the sign-in screen.</p></div></div>
          <div class="form-grid">
            <label class="field"><span class="label">Store name</span><input v-model="s.storeName" class="input" /></label>
            <label class="field"><span class="label">Phone</span><input v-model="s.phone" class="input" /></label>
            <label class="field span-2"><span class="label">Address</span><input v-model="s.address" class="input" /></label>
            <label class="field"><span class="label">Email</span><input v-model="s.email" class="input" type="email" /></label>
            <label class="field"><span class="label">Tax / business ID</span><input v-model="s.taxId" class="input" /></label>
          </div>
        </section>

        <section id="set-sales" class="card card-pad rise" style="--i: 1">
          <div class="sec-head"><span class="sec-ico"><Percent :size="18" /></span><div><h3>Sales & tax</h3><p class="muted small">Currency, tax and stock rules for the register.</p></div></div>
          <div class="form-grid">
            <label class="field"><span class="label">Currency</span>
              <select v-model="s.currency" class="select">
                <option v-for="c in CURRENCIES" :key="c[0]" :value="c[0]">{{ c[0] }} — {{ c[1] }}</option>
              </select>
              <span class="hint">Preview: {{ formatMoney(1234.5, s.currency) }}</span>
            </label>
            <label class="field"><span class="label">Tax rate (%)</span><input v-model.number="s.taxRate" class="input" type="number" min="0" max="100" step="0.01" /></label>
            <label class="field"><span class="label">Low-stock alert at</span><input v-model.number="s.lowStockThreshold" class="input" type="number" min="0" /></label>
            <label class="field"><span class="label">Default opening float</span><input v-model.number="s.defaultFloat" class="input" type="number" min="0" step="0.01" /></label>
            <div class="span-2 toggles">
              <label class="switch"><input v-model="s.taxInclusive" type="checkbox" /><span class="track"></span><div><strong>Prices include tax</strong><span class="muted small">Tax is extracted from shelf prices instead of added on top.</span></div></label>
              <label class="switch"><input v-model="s.requireShift" type="checkbox" /><span class="track"></span><div><strong>Require an open shift to sell</strong><span class="muted small">Keeps every cash sale tied to a reconciled drawer.</span></div></label>
            </div>
          </div>
        </section>

        <section id="set-loyalty" class="card card-pad rise" style="--i: 2">
          <div class="sec-head"><span class="sec-ico"><Star :size="18" /></span><div><h3>Loyalty program</h3><p class="muted small">Reward regulars with points they can spend at the till.</p></div></div>
          <div class="form-grid">
            <label class="switch span-2"><input v-model="s.loyaltyEnabled" type="checkbox" /><span class="track"></span><strong>Enable loyalty points</strong></label>
            <label class="field"><span class="label">Points earned per 1 {{ s.currency }} spent</span><input v-model.number="s.pointsPerUnit" class="input" type="number" min="0" step="0.1" :disabled="!s.loyaltyEnabled" /></label>
            <label class="field"><span class="label">Value of 1 point ({{ s.currency }})</span><input v-model.number="s.pointValue" class="input" type="number" min="0" step="0.01" :disabled="!s.loyaltyEnabled" /></label>
            <label class="field"><span class="label">Silver tier from lifetime spend ({{ s.currency }})</span><input v-model.number="s.tierSilver" class="input" type="number" min="0" step="1" :disabled="!s.loyaltyEnabled" /></label>
            <label class="field"><span class="label">Gold tier from lifetime spend ({{ s.currency }})</span><input v-model.number="s.tierGold" class="input" type="number" min="0" step="1" :disabled="!s.loyaltyEnabled" /></label>
            <p class="span-2 muted small">Set both to 0 to hide customer tiers. Gold should be higher than Silver.</p>
            <p class="span-2 example">
              A {{ formatMoney(20, s.currency) }} purchase earns <b>{{ Math.floor(20 * (s.pointsPerUnit || 0)) }} points</b>, worth
              <b>{{ formatMoney(Math.floor(20 * (s.pointsPerUnit || 0)) * (s.pointValue || 0), s.currency) }}</b> off a future visit
              ({{ ((s.pointsPerUnit || 0) * (s.pointValue || 0) * 100).toFixed(1) }}% back).
            </p>
          </div>
        </section>

        <section id="set-receipt" class="card card-pad rise" style="--i: 3">
          <div class="sec-head"><span class="sec-ico"><Receipt :size="18" /></span><div><h3>Receipt</h3><p class="muted small">{{ lastOrder ? `Previewing your latest sale (#${lastOrder.number}).` : 'Example preview. Your real sales will show here.' }} Updates as you type.</p></div></div>
          <div class="receipt-grid">
            <div class="stack">
              <label class="field"><span class="label">Thank-you line</span><input v-model="s.receiptHeader" class="input" /></label>
              <label class="field"><span class="label">Footer / return policy</span><textarea v-model="s.receiptFooter" class="textarea"></textarea></label>
              <p class="muted small">Receipts print at 80 mm thermal width from any browser print dialog.</p>
            </div>
            <div class="receipt-preview"><ReceiptPaper :order="sampleOrder" /></div>
          </div>
        </section>

        <section id="set-look" class="card card-pad rise" style="--i: 4">
          <div class="sec-head"><span class="sec-ico"><Palette :size="18" /></span><div><h3>Appearance</h3><p class="muted small">Theme and accent gradient for every screen.</p></div></div>
          <div class="field">
            <span class="label">Theme</span>
            <div class="themes">
              <button class="theme dark" :class="{ on: s.theme === 'dark' }" @click="s.theme = 'dark'"><Moon :size="18" /> Dark</button>
              <button class="theme light" :class="{ on: s.theme === 'light' }" @click="s.theme = 'light'"><Sun :size="18" /> Light</button>
            </div>
          </div>
          <div class="field mt">
            <span class="label">Accent</span>
            <div class="accents">
              <button v-for="a in ACCENTS" :key="a.id" class="accent" :class="{ on: s.accent === a.id }" @click="s.accent = a.id">
                <span class="swatch" :style="{ background: `linear-gradient(135deg, ${a.colors.join(', ')})` }">
                  <Transition name="pop"><Check v-if="s.accent === a.id" :size="18" /></Transition>
                </span>
                {{ a.label }}
              </button>
            </div>
          </div>
        </section>

        <section id="set-app" class="card card-pad rise" style="--i: 5">
          <div class="sec-head"><span class="sec-ico"><MonitorDown :size="18" /></span><div><h3>Install app</h3><p class="muted small">Run Maynex POS in its own window, from your desktop, dock or home screen. It keeps working offline.</p></div></div>
          <div v-if="installed" class="example"><Check :size="15" class="inline" /> Maynex POS is running as an installed app on this device.</div>
          <button v-else-if="canInstall" class="btn btn-primary btn-lg" @click="install"><MonitorDown :size="18" /> Install Maynex POS on this device</button>
          <p v-else-if="isIOS" class="example">On iPhone or iPad: tap <Share :size="14" class="inline" /> <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</p>
          <p v-else class="example">Your browser hasn't offered installation yet. In Chrome or Edge, use the install icon at the right of the address bar, or the menu → <b>Install Maynex POS</b>. Installation needs the site to be opened over https or on localhost.</p>
        </section>

        <section id="set-account" class="card card-pad rise" style="--i: 6">
          <div class="sec-head">
            <span class="sec-ico"><Cloud :size="18" /></span>
            <div class="grow"><h3>Business account</h3><p class="muted small">This device belongs to your business. Everything syncs to the Maynex POS server and keeps working offline.</p></div>
            <span class="badge" :class="syncTone"><span class="dot"></span>{{ syncLabels[sync.status] }}</span>
          </div>
          <div class="stack">
            <div class="sync-grid">
              <div><span class="muted tiny">Business</span><b class="ellipsis">{{ pos.business?.name }}</b></div>
              <div><span class="muted tiny">Owner login</span><b class="ellipsis">{{ pos.business?.email || sync.email || '—' }}</b></div>
              <div><span class="muted tiny">Last sync</span><b>{{ sync.lastSyncedAt ? timeAgo(sync.lastSyncedAt) : '—' }}</b></div>
            </div>
            <p v-if="sync.error" class="c-danger small">{{ sync.error }} Changes are kept on this device and retried automatically.</p>
            <form v-if="sync.configured && sync.status === 'signed-out'" class="row wrap" @submit.prevent="reconnect">
              <input v-model="login.password" class="input" style="max-width: 260px" type="password" autocomplete="current-password" placeholder="Owner password" />
              <button class="btn btn-primary" type="submit" :disabled="busy || !login.password"><LogIn :size="16" /> Reconnect</button>
            </form>
            <div class="row wrap">
              <button v-if="sync.online" class="btn btn-soft" :disabled="busy" @click="syncNow"><RefreshCw :size="16" :class="{ spinning: sync.status === 'syncing' }" /> Sync now</button>
              <button class="btn btn-danger" :disabled="busy" @click="leave"><LogOut :size="16" /> Sign this device out</button>
            </div>
          </div>
        </section>

        <section id="set-data" class="card card-pad rise" style="--i: 7">
          <div class="sec-head"><span class="sec-ico"><Database :size="18" /></span><div><h3>Data & backup</h3><p class="muted small">Synced to the server and kept on this device. You can also download your own copy at any time.</p></div></div>
          <div class="data-actions">
            <button class="data-btn" @click="exportBackup"><Download :size="20" /><strong>Download backup</strong><span class="muted small">Full JSON export of all data</span></button>
            <button class="data-btn" @click="fileEl.click()"><Upload :size="20" /><strong>Restore backup</strong><span class="muted small">Replace data from a backup file</span></button>
            <button class="data-btn danger" @click="wipe"><Trash2 :size="20" /><strong>Start fresh</strong><span class="muted small">Erase everything but your account</span></button>
          </div>
          <input ref="fileEl" type="file" accept="application/json,.json" hidden @change="importBackup" />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.saved { padding: 6px 12px; }
.layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 20px; align-items: start; }
.side { position: sticky; top: 0; display: flex; flex-direction: column; gap: 2px; padding: 8px; }
.side button { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 0; background: transparent; color: var(--text-2); font: 620 13.5px var(--font); cursor: pointer; text-align: left; transition: all .25s var(--ease); }
.side button:hover { color: var(--text); background: var(--surface-2); }
.side button.on { color: var(--accent-ink); background: color-mix(in srgb, var(--c1) 14%, transparent); }
.sections { display: flex; flex-direction: column; gap: 18px; }
.sections section { scroll-margin-top: 10px; }
.sec-head { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 18px; }
.sec-head h3 { font-size: 16px; font-weight: 800; }
.sec-ico { width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; flex-shrink: 0; color: #fff; background: var(--grad); box-shadow: 0 10px 20px -10px var(--c1); }
.toggles { display: flex; flex-direction: column; gap: 14px; }
.toggles .switch { align-items: flex-start; }
.toggles .switch > div { display: flex; flex-direction: column; line-height: 1.35; }
.example { padding: 12px 14px; border-radius: 14px; background: var(--grad-soft); border: 1px solid var(--border); font-size: 13px; }
.receipt-grid { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 22px; align-items: start; }
.receipt-preview { padding: 18px 0 8px; border-radius: 18px; background: var(--surface-2); }
.themes { display: flex; gap: 10px; }
.theme { flex: 1; max-width: 220px; display: flex; align-items: center; justify-content: center; gap: 8px; height: 76px; border-radius: 16px; border: 2px solid var(--border); cursor: pointer; font: 700 14px var(--font); transition: all .3s var(--ease); }
.theme.dark { background: linear-gradient(135deg, #0e0e19, #1d1d33); color: #efeef8; }
.theme.light { background: linear-gradient(135deg, #ffffff, #e9e9f5); color: #15152b; }
.theme:hover { transform: translateY(-2px); }
.theme.on { border-color: var(--c1); box-shadow: 0 0 0 4px color-mix(in srgb, var(--c1) 22%, transparent); }
.accents { display: flex; flex-wrap: wrap; gap: 14px; }
.accent { display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: 0; cursor: pointer; font: 650 12.5px var(--font); color: var(--text-2); }
.accent .swatch { width: 64px; height: 64px; border-radius: 20px; display: grid; place-items: center; color: #fff; border: 3px solid transparent; transition: transform .35s var(--spring), box-shadow .3s; }
.accent:hover .swatch { transform: scale(1.06) rotate(-4deg); }
.accent.on { color: var(--text); }
.accent.on .swatch { border-color: var(--bg-2); box-shadow: 0 0 0 2px var(--c1), 0 12px 24px -10px var(--c1); }
.data-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
.data-btn { --t: var(--c1); display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 16px; border-radius: 16px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; text-align: left; transition: all .3s var(--ease); }
.data-btn svg { color: var(--t); margin-bottom: 6px; }
.data-btn:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--t) 45%, transparent); background: color-mix(in srgb, var(--t) 8%, var(--surface-2)); }
.inline { display: inline; vertical-align: -2px; }
.data-btn.danger { --t: var(--danger); }
.steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; color: var(--text-2); }
.steps code { font-family: var(--mono); font-size: 12px; padding: 1px 6px; border-radius: 6px; background: var(--surface-3); }
.sync-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.sync-grid > div { display: flex; flex-direction: column; min-width: 0; padding: 12px 14px; border-radius: 14px; background: var(--surface-2); }
.spinning { animation: spin 1s linear infinite; }
@media (max-width: 700px) { .sync-grid { grid-template-columns: 1fr; } }
@media (max-width: 1000px) {
  .layout { grid-template-columns: 1fr; }
  .side { position: static; flex-direction: row; overflow-x: auto; }
  .side button { white-space: nowrap; }
  .receipt-grid { grid-template-columns: 1fr; }
}
</style>

<script setup>
import { ref, computed } from 'vue'
import { Search, UserPlus, Users, Sparkles, Wallet, Star, Phone, Mail, Pencil, Trash2, Crown, Award, Medal, ReceiptText } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useMoney, toast, confirm } from '@/composables'
import { initials, timeAgo, formatDate, formatDateTime, itemsSummary } from '@/utils/format'
import BaseModal from '@/components/BaseModal.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import StatCard from '@/components/StatCard.vue'

const pos = usePos()
const money = useMoney()

const q = ref('')
const sort = ref('spent')
const sorts = [['spent', 'Top spend'], ['recent', 'Recent'], ['points', 'Points'], ['name', 'A–Z']]

// Tiers use the thresholds from Settings → Loyalty; with none set, no tier badge is shown.
const tiers = computed(() => {
  const s = pos.settings
  const silver = Number(s.tierSilver) || 0
  const gold = Number(s.tierGold) || 0
  if (!s.loyaltyEnabled || (!silver && !gold)) return []
  return [
    gold > 0 && { id: 'gold', label: 'Gold', min: gold, color: '#f59e0b', icon: Crown },
    silver > 0 && { id: 'silver', label: 'Silver', min: silver, color: '#94a3b8', icon: Award },
    { id: 'bronze', label: 'Member', min: 0, color: '#c2410c', icon: Medal },
  ].filter(Boolean).sort((a, b) => b.min - a.min)
})
const tierOf = (c) => tiers.value.find((t) => (c.totalSpent || 0) >= t.min) || null
const palette = ['#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#f97316']
const colorOf = (c) => palette[[...c.id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % palette.length]

const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  const arr = pos.customers.filter((c) => !s || c.name.toLowerCase().includes(s) || (c.phone || '').includes(s) || (c.email || '').toLowerCase().includes(s))
  const by = {
    spent: (a, b) => (b.totalSpent || 0) - (a.totalSpent || 0),
    recent: (a, b) => (b.lastVisit || 0) - (a.lastVisit || 0),
    points: (a, b) => (b.points || 0) - (a.points || 0),
    name: (a, b) => a.name.localeCompare(b.name),
  }[sort.value]
  return [...arr].sort(by)
})

const stats = computed(() => {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  const list = pos.customers
  const spent = list.reduce((s, c) => s + (c.totalSpent || 0), 0)
  return {
    total: list.length,
    newMonth: list.filter((c) => c.createdAt >= d.getTime()).length,
    avg: list.length ? spent / list.length : 0,
    points: list.reduce((s, c) => s + (c.points || 0), 0),
  }
})

/* profile */
const showProfile = ref(false)
const current = ref(null)
const history = computed(() => (current.value ? pos.orders.filter((o) => o.customerId === current.value.id) : []))
const favourite = computed(() => {
  const m = new Map()
  for (const o of history.value) for (const i of o.items) m.set(i.name, { icon: i.icon, qty: (m.get(i.name)?.qty || 0) + i.qty })
  let best = null
  for (const [name, v] of m) if (!best || v.qty > best.qty) best = { name, ...v }
  return best
})
function openProfile(c) {
  current.value = c
  showProfile.value = true
}

/* form */
const showForm = ref(false)
const draft = ref({})
function openForm(c) {
  draft.value = c ? { ...c } : { name: '', phone: '', email: '', notes: '' }
  showForm.value = true
}
function save() {
  if (!draft.value.name?.trim()) return toast('Name is required', 'warning')
  const saved = pos.saveCustomer({ ...draft.value, name: draft.value.name.trim() })
  if (current.value?.id === saved.id) current.value = saved
  toast(draft.value.id ? 'Customer updated' : `${saved.name} added`)
  showForm.value = false
}
async function remove(c) {
  if (await confirm({ title: `Remove ${c.name}?`, message: 'Their order history stays, but loyalty points are lost.', confirmText: 'Remove', danger: true })) {
    pos.deleteCustomer(c.id)
    showProfile.value = false
    toast('Customer removed', 'info')
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Customers</h1>
        <p>Profiles, purchase history and loyalty rewards.</p>
      </div>
      <button class="btn btn-primary" @click="openForm()"><UserPlus :size="16" /> New customer</button>
    </div>

    <div class="kpis">
      <StatCard label="Customers" :value="stats.total" :icon="Users" tone="#8b5cf6" hint="in your directory" :index="0" />
      <StatCard label="New this month" :value="stats.newMonth" :icon="Sparkles" tone="#22d3ee" hint="joined since the 1st" :index="1" />
      <StatCard label="Avg. lifetime spend" :value="stats.avg" :format="money" :icon="Wallet" tone="#ec4899" hint="per customer" :index="2" />
      <StatCard label="Points outstanding" :value="stats.points" :icon="Star" tone="#f59e0b" :hint="`worth ${money(stats.points * pos.settings.pointValue)}`" :index="3" />
    </div>

    <div class="toolbar mt">
      <div class="input-icon grow" style="min-width: 220px; max-width: 420px">
        <Search :size="17" />
        <input v-model="q" class="input" placeholder="Search by name, phone or email…" />
      </div>
      <div class="segmented">
        <button v-for="s in sorts" :key="s[0]" :class="{ active: sort === s[0] }" @click="sort = s[0]">{{ s[1] }}</button>
      </div>
    </div>

    <TransitionGroup v-if="list.length" tag="div" name="list" class="cgrid">
      <button v-for="(c, i) in list" :key="c.id" class="ccard card rise" :style="{ '--i': Math.min(i, 12), '--tier': tierOf(c)?.color || 'transparent' }" @click="openProfile(c)">
        <div class="ctop">
          <div class="avatar" :style="{ '--a': colorOf(c), '--s': '48px' }">{{ initials(c.name) }}</div>
          <div class="grow">
            <strong class="ellipsis">{{ c.name }}</strong>
            <span class="muted small ellipsis">{{ c.phone || c.email || 'No contact info' }}</span>
          </div>
          <span v-if="tierOf(c)" class="tier"><component :is="tierOf(c).icon" :size="12" /> {{ tierOf(c).label }}</span>
        </div>
        <div class="cstats">
          <div><span>Spent</span><b class="num">{{ money(c.totalSpent || 0) }}</b></div>
          <div><span>Visits</span><b class="num">{{ c.visits || 0 }}</b></div>
          <div><span>Points</span><b class="num">{{ c.points || 0 }}</b></div>
        </div>
        <div class="muted tiny">Last visit {{ c.lastVisit ? timeAgo(c.lastVisit) : 'never' }}</div>
      </button>
    </TransitionGroup>
    <div v-else class="card empty">
      <div class="empty-icon"><Users :size="26" /></div>
      <strong>{{ pos.customers.length ? 'No customers match your search' : 'No customers yet' }}</strong>
      <span class="small">Add customers here or right from the register.</span>
    </div>

    <BaseModal v-model:open="showProfile" size="lg">
      <template #header>
        <div v-if="current" class="phead">
          <div class="avatar" :style="{ '--a': colorOf(current), '--s': '64px' }">{{ initials(current.name) }}</div>
          <div>
            <h3>{{ current.name }}</h3>
            <div class="row wrap small muted" style="gap: 14px; margin-top: 4px">
              <span v-if="current.phone" class="row" style="gap: 5px"><Phone :size="13" />{{ current.phone }}</span>
              <span v-if="current.email" class="row" style="gap: 5px"><Mail :size="13" />{{ current.email }}</span>
              <span>Since {{ formatDate(current.createdAt) }}</span>
            </div>
          </div>
        </div>
      </template>
      <div v-if="current" class="stack">
        <div class="pstats">
          <div class="pstat"><span>Lifetime spend</span><b class="num">{{ money(current.totalSpent || 0) }}</b></div>
          <div class="pstat"><span>Visits</span><b class="num">{{ current.visits || 0 }}</b></div>
          <div class="pstat"><span>Avg. order</span><b class="num">{{ money(current.visits ? current.totalSpent / current.visits : 0) }}</b></div>
          <div class="pstat accent"><span>Loyalty points</span><b class="num">{{ current.points || 0 }}</b><small>≈ {{ money((current.points || 0) * pos.settings.pointValue) }}</small></div>
        </div>
        <div v-if="favourite" class="fav">
          <span class="fav-icon"><ItemIcon :name="favourite.icon" :label="favourite.name" :size="20" /></span>
          <div><span class="muted small">Usual order</span><strong>{{ favourite.name }}</strong></div>
          <span class="badge b-primary">{{ favourite.qty }}× bought</span>
        </div>
        <p v-if="current.notes" class="note">{{ current.notes }}</p>
        <div class="card-title">Purchase history</div>
        <div v-if="history.length" class="hist">
          <div v-for="o in history.slice(0, 25)" :key="o.id" class="hrow">
            <span class="mono bold">#{{ o.number }}</span>
            <span class="muted small grow">{{ formatDateTime(o.createdAt) }}</span>
            <span class="muted small ellipsis items-cell">{{ itemsSummary(o.items) }}</span>
            <span v-if="o.status === 'refunded'" class="badge b-danger">Refunded</span>
            <b class="num">{{ money(o.total) }}</b>
          </div>
        </div>
        <div v-else class="empty small"><ReceiptText :size="20" /> No purchases yet</div>
      </div>
      <template #footer>
        <button class="btn btn-danger" @click="remove(current)"><Trash2 :size="15" /> Remove</button>
        <span class="grow"></span>
        <button class="btn" @click="openForm(current)"><Pencil :size="15" /> Edit</button>
      </template>
    </BaseModal>

    <BaseModal v-model:open="showForm" size="md" :title="draft.id ? 'Edit customer' : 'New customer'">
      <div class="form-grid">
        <label class="field span-2"><span class="label">Full name *</span><input v-model="draft.name" class="input" placeholder="e.g. Jamie Doe" /></label>
        <label class="field"><span class="label">Phone</span><input v-model="draft.phone" class="input" placeholder="+1 555 …" /></label>
        <label class="field"><span class="label">Email</span><input v-model="draft.email" class="input" type="email" placeholder="name@email.com" /></label>
        <label class="field span-2"><span class="label">Notes</span><textarea v-model="draft.notes" class="textarea" placeholder="Preferences, allergies, birthdays…"></textarea></label>
      </div>
      <template #footer>
        <button class="btn" @click="showForm = false">Cancel</button>
        <button class="btn btn-primary" @click="save">{{ draft.id ? 'Save changes' : 'Add customer' }}</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.cgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); gap: clamp(10px, 1.2vw, 14px); }
.ccard { display: flex; flex-direction: column; gap: 14px; padding: 18px; text-align: left; cursor: pointer; font: inherit; color: inherit; transition: transform .4s var(--ease), border-color .3s, box-shadow .4s; overflow: hidden; }
.ccard::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--tier); opacity: .7; }
.ccard:hover { transform: translateY(-4px); border-color: var(--border-2); box-shadow: 0 24px 40px -24px rgba(0, 0, 0, .5); }
.ctop { display: flex; align-items: center; gap: 12px; }
.ctop .grow { display: flex; flex-direction: column; line-height: 1.35; }
.tier { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 750; color: var(--tier); background: color-mix(in srgb, var(--tier) 15%, transparent); flex-shrink: 0; }
.cstats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.cstats div { display: flex; flex-direction: column; padding: 8px 10px; border-radius: 12px; background: var(--surface-2); }
.cstats span { font-size: 11px; color: var(--muted); font-weight: 650; }
.cstats b { font-size: 14px; }

.phead { display: flex; align-items: center; gap: 16px; }
.phead h3 { font-size: 21px; font-weight: 800; }
.pstats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.pstat { display: flex; flex-direction: column; padding: 14px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border); }
.pstat span { font-size: 11.5px; color: var(--muted); font-weight: 650; }
.pstat b { font-size: 19px; font-weight: 800; letter-spacing: -.02em; }
.pstat small { color: var(--muted); font-size: 11px; }
.pstat.accent { background: var(--grad); border-color: transparent; color: #fff; }
.pstat.accent span, .pstat.accent small { color: rgba(255, 255, 255, .8); }
.fav { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: var(--grad-soft); border: 1px solid var(--border); }
.fav > div { flex: 1; display: flex; flex-direction: column; line-height: 1.3; }
.fav-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: var(--accent-ink); background: var(--surface); flex-shrink: 0; }
.note { padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--warning) 10%, transparent); border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent); font-size: 13px; }
.hist { display: flex; flex-direction: column; max-height: 260px; overflow-y: auto; }
.hrow { display: flex; align-items: center; gap: 12px; padding: 10px 6px; border-bottom: 1px solid var(--border); }
.hrow:last-child { border-bottom: 0; }
.items-cell { max-width: 200px; }
@media (max-width: 760px) {
  .pstats { grid-template-columns: repeat(2, 1fr); }
}
</style>

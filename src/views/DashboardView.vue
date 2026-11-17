<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Wallet, ReceiptText, Coins, TrendingUp, ShoppingCart, PackagePlus, Clock, ChartColumn, TriangleAlert, ArrowRight, Sparkles, Check, UserPlus, Store } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useMoney, useMoneyCompact } from '@/composables'
import { startOfDay, addDays, pctChange, timeAgo, initials, itemsSummary } from '@/utils/format'
import { inRange, summarize, salesByDay, salesByHour, byPayment, topProducts } from '@/utils/analytics'
import { paymentLabel } from '@/utils/constants'
import StatCard from '@/components/StatCard.vue'
import AreaChart from '@/components/AreaChart.vue'
import DonutChart from '@/components/DonutChart.vue'
import BarList from '@/components/BarList.vue'
import ColumnChart from '@/components/ColumnChart.vue'
import ItemIcon from '@/components/ItemIcon.vue'

const pos = usePos()
const router = useRouter()
const money = useMoney()
const compact = useMoneyCompact()

const today = startOfDay()
const now = Date.now()
const todayOrders = computed(() => inRange(pos.orders, today, addDays(today, 1)))
const sameTimeYesterday = computed(() => inRange(pos.orders, addDays(today, -1), now - 86400000))
const t = computed(() => summarize(todayOrders.value))
const y = computed(() => summarize(sameTimeYesterday.value))

const kpis = computed(() => [
  { label: "Today's sales", value: t.value.revenue, format: money, icon: Wallet, tone: '#8b5cf6', delta: pctChange(t.value.revenue, y.value.revenue), hint: 'vs. this time yesterday' },
  { label: 'Orders', value: t.value.count, icon: ReceiptText, tone: '#22d3ee', delta: pctChange(t.value.count, y.value.count), hint: `${t.value.items} items sold` },
  { label: 'Average ticket', value: t.value.avg, format: money, icon: Coins, tone: '#f472b6', delta: pctChange(t.value.avg, y.value.avg), hint: 'per order' },
  { label: 'Gross profit', value: t.value.profit, format: money, icon: TrendingUp, tone: '#22c55e', delta: pctChange(t.value.profit, y.value.profit), hint: `${t.value.margin.toFixed(1)}% margin` },
])

const trendFrom = addDays(today, -13)
const trend = computed(() => salesByDay(pos.orders, trendFrom, 14))
const trendPrev = computed(() => salesByDay(pos.orders, addDays(trendFrom, -14), 14))
const trendTotal = computed(() => trend.value.reduce((s, d) => s + d.value, 0))
const trendPrevTotal = computed(() => trendPrev.value.reduce((s, d) => s + d.value, 0))
const weekOrders = computed(() => inRange(pos.orders, addDays(today, -6), addDays(today, 1)))
const payments = computed(() => byPayment(weekOrders.value))
const top = computed(() => topProducts(weekOrders.value, 6).map((p) => ({ label: p.name, icon: p.icon || '', value: p.revenue, sub: `${p.qty} sold` })))
const hourly = computed(() => salesByHour(todayOrders.value, 7, 21))
const recent = computed(() => pos.orders.slice(0, 7))

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
})
const firstName = computed(() => pos.currentUser?.name.split(' ')[0])
const trendDelta = computed(() => pctChange(trendTotal.value, trendPrevTotal.value))

// first-run checklist, built only from what actually exists in the store
const checklist = computed(() =>
  [
    { label: 'Create your store', done: true, icon: Store },
    { label: 'Add your first product', done: pos.products.length > 0, icon: PackagePlus, to: { path: '/products', query: { new: '1' } }, perm: 'products' },
    { label: 'Add your team', done: pos.staff.length > 1, icon: UserPlus, to: '/staff', perm: 'staff', optional: true },
    { label: 'Open a cash shift', done: !!pos.activeShift || pos.shifts.length > 0, icon: Clock, to: '/shifts', perm: 'shifts', hide: !pos.settings.requireShift },
    { label: 'Make your first sale', done: pos.orders.length > 0, icon: ShoppingCart, to: '/register', perm: 'register' },
  ].filter((s) => !s.hide && (!s.perm || pos.can(s.perm))),
)
const showChecklist = computed(() => pos.orders.length === 0)
const doneCount = computed(() => checklist.value.filter((s) => s.done).length)

const actions = computed(() =>
  [
    { label: 'New sale', icon: ShoppingCart, to: '/register', perm: 'register', primary: true },
    { label: 'Add product', icon: PackagePlus, to: { path: '/products', query: { new: '1' } }, perm: 'products' },
    { label: pos.activeShift ? 'Cash drawer' : 'Open shift', icon: Clock, to: '/shifts', perm: 'shifts' },
    { label: 'Reports', icon: ChartColumn, to: '/reports', perm: 'reports' },
  ].filter((a) => pos.can(a.perm)),
)
</script>

<template>
  <div class="page">
    <section class="hero card rise">
      <div class="hero-bg" aria-hidden="true"><span></span><span></span></div>
      <div class="hero-text">
        <span class="eyebrow hero-eyebrow"><Sparkles :size="13" /> {{ pos.settings.storeName || 'Your store' }}</span>
        <h1>{{ greeting }}, {{ firstName }}</h1>
        <p>
          <template v-if="t.count">You've taken <b>{{ money(t.revenue) }}</b> across <b>{{ t.count }}</b> orders today.</template>
          <template v-else-if="pos.orders.length">No sales yet today.</template>
          <template v-else>Welcome to Maynex POS. Follow the steps below to make your first sale.</template>
          <template v-if="pos.lowStock.length"> {{ pos.lowStock.length }} item{{ pos.lowStock.length > 1 ? 's are' : ' is' }} running low.</template>
        </p>
      </div>
      <div class="hero-actions">
        <RouterLink v-for="a in actions" :key="a.label" :to="a.to" class="btn" :class="a.primary ? 'btn-primary btn-lg' : 'btn-lg glassy'">
          <component :is="a.icon" :size="18" /> {{ a.label }}
        </RouterLink>
      </div>
    </section>

    <section v-if="showChecklist" class="card card-pad mt rise checklist" style="--i: 1">
      <div class="card-head">
        <div>
          <div class="card-title">Get set up</div>
          <div class="card-sub">{{ doneCount }} of {{ checklist.length }} done</div>
        </div>
        <div class="cl-meter"><i :style="{ width: (doneCount / checklist.length) * 100 + '%' }"></i></div>
      </div>
      <ol class="cl-steps">
        <li v-for="st in checklist" :key="st.label" :class="{ done: st.done }">
          <span class="cl-ico"><Check v-if="st.done" :size="15" /><component :is="st.icon" v-else :size="15" /></span>
          <span class="grow">{{ st.label }}<span v-if="st.optional && !st.done" class="muted small"> · optional</span></span>
          <RouterLink v-if="!st.done && st.to" :to="st.to" class="btn btn-soft btn-sm">Start <ArrowRight :size="14" /></RouterLink>
        </li>
      </ol>
    </section>

    <div class="kpis mt">
      <StatCard v-for="(k, i) in kpis" :key="k.label" v-bind="k" :index="i + 1" />
    </div>

    <div class="grid cols-2-1 mt">
      <section class="card card-pad rise" style="--i: 5">
        <div class="card-head">
          <div>
            <div class="card-title">Sales trend</div>
            <div class="card-sub">Last 14 days · dashed line is the previous 14</div>
          </div>
          <div class="right">
            <div class="big num">{{ money(trendTotal) }}</div>
            <span v-if="trendDelta !== null" class="badge" :class="trendDelta >= 0 ? 'b-success' : 'b-danger'">
              {{ trendDelta >= 0 ? '▲' : '▼' }} {{ Math.abs(trendDelta).toFixed(1) }}%
            </span>
          </div>
        </div>
        <AreaChart :data="trend" :compare="trendPrev" :format="money" :axis-format="compact" :height="250" />
      </section>
      <section class="card card-pad rise" style="--i: 6">
        <div class="card-head">
          <div>
            <div class="card-title">Payment mix</div>
            <div class="card-sub">Last 7 days</div>
          </div>
        </div>
        <DonutChart :segments="payments" :format="money" center-label="Collected" />
      </section>
    </div>

    <div class="grid cols-3 mt">
      <section class="card card-pad rise" style="--i: 7">
        <div class="card-head">
          <div>
            <div class="card-title">Today by hour</div>
            <div class="card-sub">Busiest hour is highlighted</div>
          </div>
        </div>
        <ColumnChart :data="hourly" :format="money" :height="210" :label-every="2" />
      </section>
      <section class="card card-pad rise" style="--i: 8">
        <div class="card-head">
          <div>
            <div class="card-title">Best sellers</div>
            <div class="card-sub">Revenue · last 7 days</div>
          </div>
        </div>
        <BarList :items="top" :format="money" />
      </section>
      <section class="card card-pad rise" style="--i: 9">
        <div class="card-head">
          <div>
            <div class="card-title">Stock alerts</div>
            <div class="card-sub">At or below {{ pos.settings.lowStockThreshold }} units</div>
          </div>
          <RouterLink v-if="pos.can('products')" :to="{ path: '/products', query: { stock: 'low' } }" class="btn btn-sm btn-ghost">View <ArrowRight :size="14" /></RouterLink>
        </div>
        <ul v-if="pos.lowStock.length" class="alerts">
          <li v-for="p in pos.lowStock.slice(0, 6)" :key="p.id">
            <span class="a-icon" :style="{ color: pos.categoryMap[p.categoryId]?.color }"><ItemIcon :name="p.icon" :label="p.name" :size="17" /></span>
            <div class="grow">
              <strong class="ellipsis">{{ p.name }}</strong>
              <div class="mini-track"><i :style="{ width: Math.min(100, (p.stock / Math.max(1, pos.settings.lowStockThreshold)) * 100) + '%' }" :class="{ out: p.stock === 0 }"></i></div>
            </div>
            <span class="badge" :class="p.stock === 0 ? 'b-danger' : 'b-warning'">{{ p.stock === 0 ? 'Sold out' : p.stock + ' left' }}</span>
          </li>
        </ul>
        <div v-else class="empty">
          <div class="empty-icon"><TriangleAlert :size="26" /></div>
          <strong>All stocked up</strong>
          <span class="small">Nothing needs reordering right now.</span>
        </div>
      </section>
    </div>

    <section class="card mt rise" style="--i: 10">
      <div class="card-head card-pad" style="margin-bottom: 0; padding-bottom: 8px">
        <div>
          <div class="card-title">Recent orders</div>
          <div class="card-sub">Latest activity across all registers</div>
        </div>
        <RouterLink v-if="pos.can('orders')" to="/orders" class="btn btn-sm btn-ghost">All orders <ArrowRight :size="14" /></RouterLink>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Order</th><th>Items</th><th class="hide-sm">Customer</th><th class="hide-sm">Payment</th><th>When</th><th class="right">Total</th></tr>
          </thead>
          <tbody>
            <tr v-for="o in recent" :key="o.id" class="clickable" @click="router.push({ path: '/orders', query: { id: o.id } })">
              <td class="mono bold">#{{ o.number }}</td>
              <td><span class="ellipsis items-cell">{{ itemsSummary(o.items) }}</span> <span class="muted small">· {{ o.items.reduce((s, i) => s + i.qty, 0) }}</span></td>
              <td class="hide-sm">
                <div v-if="pos.customerMap[o.customerId]" class="row">
                  <div class="avatar" style="--s: 26px">{{ initials(pos.customerMap[o.customerId].name) }}</div>
                  {{ pos.customerMap[o.customerId].name }}
                </div>
                <span v-else class="muted">Walk-in</span>
              </td>
              <td class="hide-sm"><span class="badge">{{ o.payments.map((p) => paymentLabel(p.method)).join(' + ') }}</span></td>
              <td class="muted">{{ timeAgo(o.createdAt) }}</td>
              <td class="right bold num">
                <span v-if="o.status === 'refunded'" class="badge b-danger" style="margin-right: 6px">Refunded</span>{{ money(o.total) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!recent.length" class="empty"><strong>No orders yet</strong><span class="small">Sales will appear here as they happen.</span></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
  padding: 30px 32px; border: 0; color: #fff;
  background: var(--grad); background-size: 200% 200%; animation: gradientShift 14s ease infinite, rise .7s var(--ease) both;
  box-shadow: 0 30px 60px -30px color-mix(in srgb, var(--c1) 80%, transparent);
}
.hero-bg { position: absolute; inset: 0; pointer-events: none; }
.hero-bg span { position: absolute; border-radius: 50%; background: rgba(255, 255, 255, .14); pointer-events: none; }
.hero-bg span:nth-child(1) { width: 320px; height: 320px; right: -60px; top: -160px; animation: floaty 9s ease-in-out infinite; }
.hero-bg span:nth-child(2) { width: 180px; height: 180px; right: 240px; bottom: -110px; animation: floaty 7s ease-in-out -3s infinite; }
.hero-text { position: relative; max-width: 620px; }
.hero-eyebrow { display: inline-flex; align-items: center; gap: 6px; color: rgba(255, 255, 255, .8); }
.hero h1 { font-size: 30px; font-weight: 800; letter-spacing: -.035em; margin: 6px 0 6px; }
.hero p { color: rgba(255, 255, 255, .86); font-size: 15px; }
.hero p b { color: #fff; }
.hero-actions { position: relative; display: flex; gap: 10px; flex-wrap: wrap; }
.hero .btn-primary { background: #fff; color: #17172b; box-shadow: 0 14px 30px -14px rgba(0, 0, 0, .5); }
.hero .btn-primary:hover { background: #fff; }
.hero .btn-primary::after { background: linear-gradient(110deg, transparent 30%, color-mix(in srgb, var(--c1) 25%, transparent) 50%, transparent 70%); }
.glassy { background: rgba(255, 255, 255, .16); border-color: rgba(255, 255, 255, .25); color: #fff; backdrop-filter: blur(8px); }
.glassy:hover { background: rgba(255, 255, 255, .26); border-color: rgba(255, 255, 255, .4); }
.big { font-size: 20px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 2px; }

.alerts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.alerts li { display: flex; align-items: center; gap: 12px; }
.alerts strong { display: block; font-size: 13px; }
.a-icon { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; color: var(--text-2); background: var(--surface-2); flex-shrink: 0; }
.mini-track { height: 5px; border-radius: 99px; background: var(--surface-3); margin-top: 6px; overflow: hidden; }
.mini-track i { display: block; height: 100%; border-radius: inherit; background: var(--warning); }
.mini-track i.out { background: var(--danger); width: 100% !important; opacity: .4; }
.items-cell { display: inline-block; max-width: 240px; vertical-align: bottom; }
.cl-meter { width: 140px; height: 8px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
.cl-meter i { display: block; height: 100%; border-radius: inherit; background: var(--grad); transition: width .8s var(--ease); }
.cl-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.cl-steps li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); font-weight: 650; }
.cl-steps li.done { color: var(--muted); }
.cl-steps li.done .grow { text-decoration: line-through; text-decoration-color: var(--border-2); }
.cl-ico { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; color: var(--accent-ink); background: color-mix(in srgb, var(--c1) 12%, transparent); }
.cl-steps li.done .cl-ico { color: #fff; background: var(--success); }
@media (max-width: 860px) {
  .hero { padding: 24px; }
  .hero h1 { font-size: 24px; }
}
</style>

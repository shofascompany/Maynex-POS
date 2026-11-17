<script setup>
import { ref, computed } from 'vue'
import { Wallet, ReceiptText, Coins, TrendingUp, Download, Percent, Undo2, Landmark, Package, Receipt, Boxes } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useMoney, useMoneyCompact, toast } from '@/composables'
import { pctChange, toDateInput, addDays, startOfDay, toCSV, download, formatDate } from '@/utils/format'
import { inRange, summarize, salesByDay, salesByHour, byCategory, byPayment, topProducts, byStaff, rangeFor } from '@/utils/analytics'
import StatCard from '@/components/StatCard.vue'
import AreaChart from '@/components/AreaChart.vue'
import DonutChart from '@/components/DonutChart.vue'
import ColumnChart from '@/components/ColumnChart.vue'
import ItemIcon from '@/components/ItemIcon.vue'

const pos = usePos()
const money = useMoney()
const compact = useMoneyCompact()

const rangeKey = ref('7d')
const custom = ref({ from: toDateInput(addDays(startOfDay(), -13)), to: toDateInput(Date.now()) })
const ranges = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['30d', '30 days'], ['month', 'This month'], ['custom', 'Custom']]

const r = computed(() => rangeFor(rangeKey.value, custom.value))
const span = computed(() => r.value.to - r.value.from)
const cur = computed(() => inRange(pos.orders, r.value.from, r.value.to))
const prev = computed(() => inRange(pos.orders, r.value.from - span.value, r.value.from))
const s = computed(() => summarize(cur.value))
const p = computed(() => summarize(prev.value))

const kpis = computed(() => [
  { label: 'Net sales', value: s.value.net, format: money, icon: Wallet, tone: '#8b5cf6', delta: pctChange(s.value.net, p.value.net), hint: 'excl. tax, after discounts' },
  { label: 'Orders', value: s.value.count, icon: ReceiptText, tone: '#22d3ee', delta: pctChange(s.value.count, p.value.count), hint: `${s.value.items} items sold` },
  { label: 'Average order', value: s.value.avg, format: money, icon: Coins, tone: '#ec4899', delta: pctChange(s.value.avg, p.value.avg), hint: 'incl. tax' },
  { label: 'Gross profit', value: s.value.profit, format: money, icon: TrendingUp, tone: '#22c55e', delta: pctChange(s.value.profit, p.value.profit), hint: `${s.value.margin.toFixed(1)}% margin` },
])
const metrics = computed(() => [
  { label: 'Gross sales', value: money(s.value.gross), icon: Receipt },
  { label: 'Discounts', value: '−' + money(s.value.discounts), icon: Percent },
  { label: 'Refunds', value: `${money(s.value.refunds)} · ${s.value.refundCount}`, icon: Undo2 },
  { label: 'Tax collected', value: money(s.value.tax), icon: Landmark },
  { label: 'Cost of goods', value: money(s.value.cogs), icon: Boxes },
  { label: 'Total collected', value: money(s.value.revenue), icon: Wallet },
])

const singleDay = computed(() => r.value.days <= 1)
const trend = computed(() => (singleDay.value ? salesByHour(cur.value, 6, 22) : salesByDay(cur.value, r.value.from, r.value.days)))
const trendPrev = computed(() => (singleDay.value ? salesByHour(prev.value, 6, 22) : salesByDay(prev.value, r.value.from - span.value, r.value.days)))
const categories = computed(() => byCategory(cur.value, pos.categoryMap))
const payments = computed(() => byPayment(cur.value))
const hourly = computed(() => salesByHour(cur.value, 6, 22))
const top = computed(() => topProducts(cur.value, 10))
const team = computed(() => byStaff(cur.value, pos.staffMap))
const teamMax = computed(() => Math.max(1, ...team.value.map((t) => t.revenue)))
const weekday = computed(() => {
  const names = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(undefined, { weekday: 'short' }))
  const out = names.map((label) => ({ label, value: 0, count: 0 }))
  for (const o of cur.value) {
    if (o.status === 'refunded') continue
    const d = new Date(o.createdAt).getDay()
    out[d].value += o.total
    out[d].count++
  }
  return out.map((x) => ({ ...x, value: Math.round(x.value * 100) / 100, sub: `${x.count} orders` }))
})

function exportCsv() {
  const rows = [
    ['Maynex POS report', r.value.label, `${formatDate(r.value.from)} – ${formatDate(r.value.to - 1)}`],
    [],
    ['Metric', 'Value'],
    ['Gross sales', s.value.gross], ['Discounts', s.value.discounts], ['Refunds', s.value.refunds],
    ['Net sales', s.value.net], ['Tax', s.value.tax], ['Cost of goods', s.value.cogs],
    ['Gross profit', s.value.profit], ['Margin %', s.value.margin.toFixed(2)], ['Orders', s.value.count], ['Average order', s.value.avg.toFixed(2)],
    [],
    ['Product', 'Qty', 'Revenue', 'Profit'],
    ...top.value.map((t) => [t.name, t.qty, t.revenue, t.profit]),
    [],
    ['Category', 'Revenue'],
    ...categories.value.map((c) => [c.label, c.value]),
    [],
    ['Staff', 'Orders', 'Revenue'],
    ...team.value.map((t) => [t.name, t.count, t.revenue]),
  ]
  download(`maynex-report-${rangeKey.value}-${toDateInput(Date.now())}.csv`, toCSV(rows))
  toast('Report exported')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Reports</h1>
        <p>{{ r.label }} · {{ formatDate(r.from) }}<template v-if="r.days > 1"> – {{ formatDate(r.to - 1) }}</template> · compared with the previous period</p>
      </div>
      <button class="btn" @click="exportCsv"><Download :size="16" /> Export CSV</button>
    </div>

    <div class="toolbar">
      <div class="segmented scroll">
        <button v-for="x in ranges" :key="x[0]" :class="{ active: rangeKey === x[0] }" @click="rangeKey = x[0]">{{ x[1] }}</button>
      </div>
      <Transition name="fade">
        <div v-if="rangeKey === 'custom'" class="row">
          <input v-model="custom.from" type="date" class="input" style="width: 160px" />
          <span class="muted">→</span>
          <input v-model="custom.to" type="date" class="input" style="width: 160px" />
        </div>
      </Transition>
    </div>

    <div class="kpis">
      <StatCard v-for="(k, i) in kpis" :key="k.label" v-bind="k" :index="i" />
    </div>

    <div class="metrics card mt rise" style="--i: 4">
      <div v-for="m in metrics" :key="m.label" class="metric">
        <span class="m-ico"><component :is="m.icon" :size="16" /></span>
        <div><span class="muted tiny">{{ m.label }}</span><b class="num">{{ m.value }}</b></div>
      </div>
    </div>

    <section class="card card-pad mt rise" style="--i: 5">
      <div class="card-head">
        <div>
          <div class="card-title">Sales over time</div>
          <div class="card-sub">{{ singleDay ? 'By hour' : 'By day' }} · dashed line is the previous period</div>
        </div>
        <strong class="num big">{{ money(s.revenue) }}</strong>
      </div>
      <AreaChart :data="trend" :compare="trendPrev" :format="money" :axis-format="compact" :height="280" />
    </section>

    <div class="grid cols-3 mt">
      <section class="card card-pad rise" style="--i: 6">
        <div class="card-head"><div><div class="card-title">Sales by category</div><div class="card-sub">Line revenue before order discounts</div></div></div>
        <DonutChart :segments="categories" :format="money" center-label="Categories" />
      </section>
      <section class="card card-pad rise" style="--i: 7">
        <div class="card-head"><div><div class="card-title">Payment methods</div><div class="card-sub">Net of change given</div></div></div>
        <DonutChart :segments="payments" :format="money" center-label="Collected" />
      </section>
      <section class="card card-pad rise" style="--i: 8">
        <div class="card-head"><div><div class="card-title">Team performance</div><div class="card-sub">Revenue by staff member</div></div></div>
        <ul v-if="team.length" class="team">
          <li v-for="t in team" :key="t.id">
            <div class="row between">
              <span class="row"><span class="dotc" :style="{ background: t.color }"></span><strong>{{ t.name }}</strong></span>
              <b class="num">{{ money(t.revenue) }}</b>
            </div>
            <div class="t-track"><i :style="{ width: (t.revenue / teamMax) * 100 + '%', background: t.color }"></i></div>
            <span class="muted tiny">{{ t.count }} orders · avg {{ money(t.avg) }}</span>
          </li>
        </ul>
        <div v-else class="empty small">No sales in this period</div>
      </section>
    </div>

    <div class="grid cols-2 mt">
      <section class="card card-pad rise" style="--i: 9">
        <div class="card-head"><div><div class="card-title">Busiest hours</div><div class="card-sub">Find your rush and staff for it</div></div></div>
        <ColumnChart :data="hourly" :format="money" :height="220" :label-every="2" />
      </section>
      <section class="card card-pad rise" style="--i: 10">
        <div class="card-head"><div><div class="card-title">Day of week</div><div class="card-sub">Which days carry the week</div></div></div>
        <ColumnChart :data="weekday" :format="money" :height="220" :label-every="1" />
      </section>
    </div>

    <section class="card mt rise" style="--i: 11">
      <div class="card-head card-pad" style="margin-bottom: 0; padding-bottom: 6px">
        <div><div class="card-title">Top products</div><div class="card-sub">Ranked by revenue</div></div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>#</th><th>Product</th><th class="right">Sold</th><th class="right">Revenue</th><th class="right hide-sm">Profit</th><th class="right hide-sm">Margin</th></tr></thead>
          <tbody>
            <tr v-for="(t, i) in top" :key="t.id">
              <td><span class="rank" :class="'r' + (i + 1)">{{ i + 1 }}</span></td>
              <td><span class="t-icon"><ItemIcon :name="t.icon" :label="t.name" :size="16" /></span> <strong>{{ t.name }}</strong></td>
              <td class="right num">{{ t.qty }}</td>
              <td class="right num bold">{{ money(t.revenue) }}</td>
              <td class="right num hide-sm c-success">{{ money(t.profit) }}</td>
              <td class="right num hide-sm">{{ t.revenue ? ((t.profit / t.revenue) * 100).toFixed(0) : 0 }}%</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!top.length" class="empty"><div class="empty-icon"><Package :size="26" /></div><strong>No sales in this period</strong></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.scroll { max-width: 100%; overflow-x: auto; }
.big { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
.metrics { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); padding: 6px; }
.metric { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 14px; }
.metric + .metric { border-left: 1px solid var(--border); border-radius: 0; }
.metric > div { display: flex; flex-direction: column; min-width: 0; }
.metric b { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-ico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; color: var(--accent-ink); background: var(--grad-soft); flex-shrink: 0; }
.team { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.team li { display: flex; flex-direction: column; gap: 6px; }
.dotc { width: 10px; height: 10px; border-radius: 4px; }
.t-track { height: 8px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
.t-track i { display: block; height: 100%; border-radius: inherit; animation: grow 1.1s var(--ease) both; transform-origin: left; }
@keyframes grow { from { transform: scaleX(0); } }
.rank { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 9px; font-weight: 800; font-size: 12px; background: var(--surface-2); color: var(--text-2); }
.rank.r1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #241500; }
.rank.r2 { background: linear-gradient(135deg, #e2e8f0, #94a3b8); color: #111827; }
.rank.r3 { background: linear-gradient(135deg, #fdba74, #c2410c); color: #fff; }
.t-icon { display: inline-grid; place-items: center; width: 28px; height: 28px; margin-right: 6px; border-radius: 9px; vertical-align: middle; color: var(--text-2); background: var(--surface-2); }
@media (max-width: 1200px) {
  .metrics { grid-template-columns: repeat(3, 1fr); }
  .metric:nth-child(4) { border-left: 0; }
}
@media (max-width: 640px) {
  .metrics { grid-template-columns: repeat(2, 1fr); }
  .metric { border-left: 0 !important; }
}
</style>

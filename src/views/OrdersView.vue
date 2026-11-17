<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Download, Printer, RotateCcw, ReceiptText, Wallet, Undo2 } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useMoney, toast } from '@/composables'
import { startOfDay, addDays, formatDateTime, formatDate, formatTime, initials, toCSV, download, itemsSummary } from '@/utils/format'
import ItemIcon from '@/components/ItemIcon.vue'
import { summarize } from '@/utils/analytics'
import { PAYMENT_METHODS, paymentLabel, REFUND_REASONS } from '@/utils/constants'
import BaseModal from '@/components/BaseModal.vue'
import ReceiptPaper from '@/components/ReceiptPaper.vue'
import StatCard from '@/components/StatCard.vue'

const pos = usePos()
const money = useMoney()
const route = useRoute()
const router = useRouter()

const q = ref('')
const status = ref('all')
const method = ref('all')
const range = ref('7d')
const limit = ref(40)
const ranges = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
]

// cashiers only see the sales they rang up themselves
const ownOnly = computed(() => !pos.can('orders'))
const filtered = computed(() => {
  const t0 = startOfDay()
  const from = { today: t0, '7d': addDays(t0, -6), '30d': addDays(t0, -29), all: 0 }[range.value]
  const s = q.value.trim().toLowerCase()
  const me = pos.currentUser?.id
  return pos.orders.filter((o) => {
    if (ownOnly.value && o.staffId !== me) return false
    if (o.createdAt < from) return false
    if (status.value !== 'all' && o.status !== status.value) return false
    if (method.value !== 'all' && !o.payments.some((p) => p.method === method.value)) return false
    if (!s) return true
    return (
      String(o.number).includes(s.replace('#', '')) ||
      (pos.customerMap[o.customerId]?.name || '').toLowerCase().includes(s) ||
      o.items.some((i) => i.name.toLowerCase().includes(s))
    )
  })
})
const shown = computed(() => filtered.value.slice(0, limit.value))
const sum = computed(() => summarize(filtered.value))
watch([q, status, method, range], () => (limit.value = 40))

/* detail */
const selected = ref(null)
const showDetail = ref(false)
function open(o) {
  selected.value = o
  showDetail.value = true
}
watch(showDetail, (v) => {
  if (!v && route.query.id) router.replace({ query: {} })
})
onMounted(() => {
  const id = route.query.id
  if (id) {
    const o = pos.orders.find((x) => x.id === id)
    if (o) {
      range.value = 'all'
      open(o)
    }
  }
})

/* refund */
const showRefund = ref(false)
const refundReason = ref(REFUND_REASONS[0])
const restock = ref(true)
function startRefund() {
  refundReason.value = REFUND_REASONS[0]
  restock.value = true
  showRefund.value = true
}
function doRefund() {
  const o = pos.refundOrder(selected.value.id, { restock: restock.value, reason: refundReason.value })
  if (o) {
    toast(`Order #${o.number} refunded · ${money(o.total)}`, 'info')
    showRefund.value = false
  }
}

const printReceipt = () => window.print()

function exportCsv() {
  const rows = [['Order', 'Date', 'Time', 'Customer', 'Cashier', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment', 'Status']]
  for (const o of filtered.value) {
    rows.push([
      o.number, formatDate(o.createdAt), formatTime(o.createdAt),
      pos.customerMap[o.customerId]?.name || 'Walk-in', pos.staffMap[o.staffId]?.name || '',
      o.items.map((i) => `${i.qty}x ${i.name}`).join('; '),
      o.subtotal, o.discount, o.tax, o.total,
      o.payments.map((p) => `${paymentLabel(p.method)} ${p.amount}`).join(' + '), o.status,
    ])
  }
  download(`maynex-orders-${Date.now()}.csv`, toCSV(rows))
  toast(`Exported ${filtered.value.length} orders`)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ ownOnly ? 'My sales' : 'Orders' }}</h1>
        <p>{{ ownOnly ? 'Every sale you rang up, with its receipt.' : 'Every sale, refund and receipt, searchable and exportable.' }}</p>
      </div>
      <button v-if="!ownOnly" class="btn" :disabled="!filtered.length" @click="exportCsv"><Download :size="16" /> Export CSV</button>
    </div>

    <div class="kpis">
      <StatCard label="Orders" :value="sum.count" :icon="ReceiptText" tone="#8b5cf6" :hint="ranges.find((r) => r.id === range).label" :index="0" />
      <StatCard label="Revenue" :value="sum.revenue" :format="money" :icon="Wallet" tone="#22d3ee" :hint="`avg ${money(sum.avg)}`" :index="1" />
      <StatCard label="Refunded" :value="sum.refunds" :format="money" :icon="Undo2" tone="#f43f5e" :hint="`${sum.refundCount} orders`" :index="2" />
    </div>

    <section class="card mt rise" style="--i: 3">
      <div class="filters">
        <div class="input-icon grow" style="min-width: 220px">
          <Search :size="17" />
          <input v-model="q" class="input" placeholder="Order #, customer or product…" />
        </div>
        <div class="segmented">
          <button v-for="r in ranges" :key="r.id" :class="{ active: range === r.id }" @click="range = r.id">{{ r.label }}</button>
        </div>
        <select v-model="status" class="select" style="width: 150px">
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select v-model="method" class="select" style="width: 150px">
          <option value="all">All payments</option>
          <option v-for="m in PAYMENT_METHODS" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Order</th><th>Date</th><th class="hide-sm">Customer</th><th>Items</th>
              <th class="hide-sm">Payment</th><th class="hide-sm">Cashier</th><th>Status</th><th class="right">Total</th>
            </tr>
          </thead>
          <TransitionGroup tag="tbody" name="fade">
            <tr v-for="o in shown" :key="o.id" class="clickable" @click="open(o)">
              <td class="mono bold">#{{ o.number }}</td>
              <td><div>{{ formatDate(o.createdAt) }}</div><div class="muted tiny">{{ formatTime(o.createdAt) }}</div></td>
              <td class="hide-sm">
                <div v-if="pos.customerMap[o.customerId]" class="row">
                  <div class="avatar" style="--s: 26px">{{ initials(pos.customerMap[o.customerId].name) }}</div>
                  <span class="ellipsis">{{ pos.customerMap[o.customerId].name }}</span>
                </div>
                <span v-else class="muted">Walk-in</span>
              </td>
              <td><span class="ellipsis items-cell">{{ itemsSummary(o.items) }}</span> <span class="muted small">· {{ o.items.reduce((s, i) => s + i.qty, 0) }}</span></td>
              <td class="hide-sm">
                <span v-for="(p, i) in o.payments" :key="i" class="badge pm" :style="{ color: PAYMENT_METHODS.find((m) => m.id === p.method)?.color }">{{ paymentLabel(p.method) }}</span>
              </td>
              <td class="hide-sm muted">{{ pos.staffMap[o.staffId]?.name.split(' ')[0] || '—' }}</td>
              <td>
                <span v-if="o.status === 'refunded'" class="badge b-danger"><span class="dot"></span>Refunded</span>
                <span v-else class="badge b-success"><span class="dot"></span>Paid</span>
              </td>
              <td class="right bold num">{{ money(o.total) }}</td>
            </tr>
          </TransitionGroup>
        </table>
        <div v-if="!filtered.length" class="empty">
          <div class="empty-icon"><ReceiptText :size="26" /></div>
          <strong>No orders match</strong>
          <span class="small">Try widening the date range or clearing filters.</span>
        </div>
      </div>
      <div v-if="filtered.length > limit" class="load-more">
        <button class="btn btn-soft" @click="limit += 40">Show more · {{ filtered.length - limit }} remaining</button>
      </div>
    </section>

    <BaseModal v-model:open="showDetail" size="xl" :title="selected ? `Order #${selected.number}` : ''" :subtitle="selected ? formatDateTime(selected.createdAt) : ''">
      <div v-if="selected" class="detail">
        <div class="stack">
          <div class="info-grid">
            <div class="info"><span>Status</span><b :class="selected.status === 'refunded' ? 'c-danger' : 'c-success'">{{ selected.status === 'refunded' ? 'Refunded' : 'Paid' }}</b></div>
            <div class="info"><span>Cashier</span><b>{{ pos.staffMap[selected.staffId]?.name || '—' }}</b></div>
            <div class="info"><span>Customer</span><b>{{ pos.customerMap[selected.customerId]?.name || 'Walk-in' }}</b></div>
            <div class="info"><span>Payment</span><b>{{ selected.payments.map((p) => paymentLabel(p.method)).join(' + ') }}</b></div>
          </div>
          <div class="card-title">Items</div>
          <div class="items">
            <div v-for="(it, i) in selected.items" :key="i" class="item">
              <span class="i-icon" :style="{ color: pos.categoryMap[it.categoryId]?.color }"><ItemIcon :name="it.icon" :label="it.name" :size="18" /></span>
              <div class="grow">
                <strong>{{ it.name }}</strong>
                <span class="muted small">{{ it.qty }} × {{ money(it.price) }}<template v-if="it.discount"> · −{{ it.discount }}%</template></span>
              </div>
              <b class="num">{{ money(it.total) }}</b>
            </div>
          </div>
          <div class="totals">
            <div><span>Subtotal</span><span class="num">{{ money(selected.subtotal) }}</span></div>
            <div v-if="selected.discount"><span>Discounts</span><span class="num c-success">−{{ money(selected.discount) }}</span></div>
            <div><span>Tax</span><span class="num">{{ money(selected.tax) }}</span></div>
            <div class="grand"><span>Total</span><span class="num">{{ money(selected.total) }}</span></div>
            <div v-if="selected.change"><span>Change given</span><span class="num">{{ money(selected.change) }}</span></div>
          </div>
          <div v-if="selected.status === 'refunded'" class="refund-box">
            <RotateCcw :size="18" />
            <div>
              <strong>Refunded {{ formatDateTime(selected.refundedAt) }}</strong>
              <div class="small">{{ selected.refundReason }} · by {{ pos.staffMap[selected.refundedBy]?.name || '—' }}{{ selected.restocked ? ' · items restocked' : '' }}</div>
            </div>
          </div>
          <p v-if="selected.note" class="muted small">Note: {{ selected.note }}</p>
        </div>
        <div class="receipt-col"><ReceiptPaper :order="selected" /></div>
      </div>
      <template #footer>
        <button v-if="selected?.status === 'completed' && pos.can('refund')" class="btn btn-danger" @click="startRefund">
          <RotateCcw :size="15" /> Refund
        </button>
        <span class="grow"></span>
        <button class="btn" @click="printReceipt"><Printer :size="15" /> Print</button>
        <button class="btn btn-primary" @click="showDetail = false">Done</button>
      </template>
    </BaseModal>

    <BaseModal v-model:open="showRefund" size="sm" title="Refund order" :subtitle="selected ? `#${selected.number} · ${money(selected.total)}` : ''">
      <div class="stack">
        <label class="field">
          <span class="label">Reason</span>
          <select v-model="refundReason" class="select">
            <option v-for="r in REFUND_REASONS" :key="r">{{ r }}</option>
          </select>
        </label>
        <label class="switch"><input v-model="restock" type="checkbox" /><span class="track"></span> Return items to stock</label>
        <p class="muted small">The full amount is refunded and any loyalty points earned on this order are reversed.</p>
      </div>
      <template #footer>
        <button class="btn" @click="showRefund = false">Cancel</button>
        <button class="btn btn-danger" @click="doRefund"><RotateCcw :size="15" /> Refund {{ selected ? money(selected.total) : '' }}</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 16px; border-bottom: 1px solid var(--border); }
.table-wrap { max-height: calc(100vh - 380px); min-height: 300px; }
.items-cell { display: inline-block; max-width: 220px; vertical-align: bottom; }
.pm { margin-right: 4px; background: color-mix(in srgb, currentColor 14%, transparent); }
.load-more { display: flex; justify-content: center; padding: 14px; border-top: 1px solid var(--border); }

.detail { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; align-items: start; }
.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.info { padding: 12px 14px; border-radius: 14px; background: var(--surface-2); display: flex; flex-direction: column; }
.info span { font-size: 11.5px; color: var(--muted); font-weight: 650; }
.items { display: flex; flex-direction: column; gap: 4px; }
.item { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 12px; }
.item:hover { background: var(--surface-2); }
.item .grow { display: flex; flex-direction: column; line-height: 1.3; }
.i-icon { width: 38px; height: 38px; display: grid; place-items: center; color: var(--text-2); border-radius: 12px; background: var(--surface-2); flex-shrink: 0; }
.totals { display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); }
.totals div { display: flex; justify-content: space-between; color: var(--text-2); }
.totals .grand { font-size: 18px; font-weight: 800; color: var(--text); padding-top: 6px; border-top: 1px dashed var(--border-2); }
.refund-box { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 14px; color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); border: 1px solid color-mix(in srgb, var(--danger) 28%, transparent); }
.refund-box .small { color: var(--text-2); }
.receipt-col { position: sticky; top: 0; }
@media (max-width: 900px) {
  .detail { grid-template-columns: 1fr; }
}
</style>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Banknote, CreditCard, Smartphone, Delete, X, Check } from '@lucide/vue'
import BaseModal from './BaseModal.vue'
import { useMoney } from '@/composables'
import { round2, uid } from '@/utils/format'
import { paymentLabel } from '@/utils/constants'

const props = defineProps({ open: Boolean, total: { type: Number, default: 0 } })
const emit = defineEmits(['update:open', 'complete'])
const money = useMoney()

const methods = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
]
const iconOf = (id) => methods.find((m) => m.id === id)?.icon || Banknote
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']

const method = ref('cash')
const entry = ref('')
const payments = ref([])
const processing = ref(false)

const paid = computed(() => round2(payments.value.reduce((s, p) => s + p.amount, 0)))
const remaining = computed(() => Math.max(0, round2(props.total - paid.value)))
const entered = computed(() => (entry.value ? parseFloat(entry.value) || 0 : 0))
const tenderAmount = computed(() => {
  let a = entry.value ? entered.value : remaining.value
  if (method.value !== 'cash') a = Math.min(a, remaining.value)
  return round2(a)
})
const changePreview = computed(() => (method.value === 'cash' ? Math.max(0, round2(tenderAmount.value - remaining.value)) : 0))
const willComplete = computed(() => remaining.value <= 0 || tenderAmount.value + 0.0001 >= remaining.value)
const progress = computed(() => (props.total ? Math.min(100, (paid.value / props.total) * 100) : 0))

const quick = computed(() => {
  const r = remaining.value
  if (r <= 0) return []
  const mag = Math.max(1, Math.pow(10, Math.floor(Math.log10(r)) - 1))
  const set = new Set([r])
  for (const step of [1, 5, 10, 20, 50, 100]) {
    const v = Math.ceil(r / (step * mag)) * step * mag
    if (v > r) set.add(round2(v))
  }
  return [...set].sort((a, b) => a - b).slice(0, 5)
})

function press(k) {
  if (processing.value) return
  if (k === 'del') entry.value = entry.value.slice(0, -1)
  else if (k === '.') {
    if (!entry.value.includes('.')) entry.value = (entry.value || '0') + '.'
  } else {
    const [, dec] = entry.value.split('.')
    if (dec !== undefined && dec.length >= 2) return
    if (entry.value.replace('.', '').length >= 9) return
    entry.value = entry.value === '0' ? k : entry.value + k
  }
}

function tender() {
  if (processing.value) return
  if (remaining.value > 0) {
    const amt = tenderAmount.value
    if (amt <= 0) return
    payments.value.push({ id: uid('pay_'), method: method.value, amount: amt })
    entry.value = ''
  }
  if (paid.value + 0.0001 >= props.total) {
    processing.value = true
    setTimeout(() => {
      emit('complete', payments.value.map(({ method, amount }) => ({ method, amount })))
      processing.value = false
    }, 700)
  }
}
function removePayment(i) {
  if (!processing.value) payments.value.splice(i, 1)
}

function onKey(e) {
  const tag = document.activeElement?.tagName
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
  if (/^[0-9]$/.test(e.key)) press(e.key)
  else if (e.key === '.' || e.key === ',') press('.')
  else if (e.key === 'Backspace') press('del')
  else if (e.key === 'Enter') {
    e.preventDefault()
    tender()
  } else return
  e.preventDefault()
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      method.value = 'cash'
      entry.value = ''
      payments.value = []
      processing.value = false
      window.addEventListener('keydown', onKey)
    } else window.removeEventListener('keydown', onKey)
  },
)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <BaseModal :open="open" size="lg" title="Take payment" :subtitle="payments.length ? 'Split payment in progress' : 'Pick a method — split across several if needed'" :persistent="processing" @update:open="(v) => emit('update:open', v)">
    <div class="pay">
      <section class="left">
        <div class="due">
          <span class="eyebrow">Total due</span>
          <strong class="gradient-text num">{{ money(total) }}</strong>
        </div>
        <div class="meter"><div class="meter-fill" :style="{ width: progress + '%' }"></div></div>
        <div class="kv"><span class="muted">Paid</span><b class="num">{{ money(paid) }}</b></div>
        <div class="kv"><span class="muted">Remaining</span><b class="num" :class="{ 'c-success': remaining <= 0 }">{{ money(remaining) }}</b></div>

        <TransitionGroup name="list" tag="ul" class="paid-list">
          <li v-for="(p, i) in payments" :key="p.id">
            <span class="pm-ico"><component :is="iconOf(p.method)" :size="15" /></span>
            <span class="grow">{{ paymentLabel(p.method) }}</span>
            <b class="num">{{ money(p.amount) }}</b>
            <button class="icon-btn xs" :disabled="processing" aria-label="Remove payment" @click="removePayment(i)"><X :size="12" /></button>
          </li>
        </TransitionGroup>

        <Transition name="pop">
          <div v-if="changePreview > 0" class="change">
            <span>Change to give</span>
            <strong class="num">{{ money(changePreview) }}</strong>
          </div>
        </Transition>
      </section>

      <section class="right">
        <div class="methods">
          <button v-for="m in methods" :key="m.id" class="method" :class="{ active: method === m.id }" @click="method = m.id">
            <component :is="m.icon" :size="22" />
            <span>{{ m.label }}</span>
          </button>
        </div>

        <div class="amount" :class="{ ghost: !entry }">
          <span class="muted small">{{ method === 'cash' ? 'Cash received' : 'Charge amount' }}</span>
          <strong class="num">{{ entry ? money(entered) : money(remaining) }}</strong>
        </div>

        <div class="quick" :class="{ hidden: method !== 'cash' }">
          <button v-for="q in quick" :key="q" class="chip" @click="entry = String(q)">{{ money(q) }}</button>
        </div>

        <div class="keypad">
          <button v-for="k in keys" :key="k" class="key" @click="press(k)">
            <Delete v-if="k === 'del'" :size="18" />
            <template v-else>{{ k }}</template>
          </button>
        </div>

        <button class="btn btn-primary btn-xl tender" :disabled="processing || (remaining > 0 && tenderAmount <= 0)" @click="tender">
          <template v-if="processing"><span class="spinner"></span> Processing…</template>
          <template v-else-if="willComplete"><Check :size="20" /> Complete sale</template>
          <template v-else>Add {{ money(tenderAmount) }} {{ paymentLabel(method).toLowerCase() }}</template>
        </button>
      </section>
    </div>
  </BaseModal>
</template>

<style scoped>
.pay { display: grid; grid-template-columns: 1fr 1.15fr; gap: 22px; }
.left { display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 20px; background: var(--surface); border: 1px solid var(--border); }
.due strong { display: block; font-size: 40px; font-weight: 800; letter-spacing: -.04em; line-height: 1.1; margin-top: 4px; }
.meter { height: 8px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
.meter-fill { height: 100%; background: var(--grad); border-radius: inherit; transition: width .7s var(--ease); }
.kv { display: flex; justify-content: space-between; font-size: 14px; }
.paid-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; position: relative; }
.paid-list li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: var(--surface-2); font-size: 13px; font-weight: 600; }
.pm-ico { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; background: var(--grad); color: #fff; }
.change {
  margin-top: auto; padding: 14px 16px; border-radius: 16px; display: flex; flex-direction: column;
  background: color-mix(in srgb, var(--success) 12%, transparent); border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
}
.change span { color: var(--success); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.change strong { font-size: 28px; font-weight: 800; color: var(--success); }

.right { display: flex; flex-direction: column; gap: 12px; }
.methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.method {
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; border-radius: 16px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); cursor: pointer;
  font: 700 13px var(--font); transition: all .3s var(--ease);
}
.method:hover { color: var(--text); border-color: var(--border-2); transform: translateY(-2px); }
.method.active { color: #fff; border-color: transparent; background: var(--grad); box-shadow: 0 14px 28px -14px var(--c1); }
.method.active svg { animation: popIn .45s var(--spring); }
.amount { display: flex; flex-direction: column; align-items: flex-end; padding: 10px 16px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border); }
.amount strong { font-size: 30px; font-weight: 800; letter-spacing: -.03em; line-height: 1.2; }
.amount.ghost strong { color: var(--muted); }
.quick { display: flex; flex-wrap: wrap; gap: 6px; min-height: 36px; transition: opacity .25s; }
.quick.hidden { opacity: 0; pointer-events: none; }
.keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.key {
  height: 52px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface);
  font: 700 19px var(--font); color: var(--text); cursor: pointer; display: grid; place-items: center;
  transition: transform .15s var(--ease), background .2s, border-color .2s;
}
.key:hover { background: var(--surface-3); border-color: var(--border-2); }
.key:active { transform: scale(.93); background: color-mix(in srgb, var(--c1) 20%, transparent); }
.tender { width: 100%; }

@media (max-width: 760px) {
  .pay { grid-template-columns: 1fr; gap: 14px; }
  .left { padding: 14px 16px; gap: 8px; border-radius: 18px; }
  .due strong { font-size: clamp(28px, 9vw, 36px); }
  .method { padding: 12px 6px; }
  .amount strong { font-size: 26px; }
  .key { height: 54px; font-size: 21px; }
  .quick { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .quick.hidden { display: none; }
}
@media (hover: none) {
  .method:hover { transform: none; }
  .key:hover { background: var(--surface); border-color: var(--border); }
}
</style>

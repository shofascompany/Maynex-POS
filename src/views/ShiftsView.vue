<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Banknote, CreditCard, Smartphone, ArrowDownToLine, ArrowUpFromLine, CircleStop, CirclePlay, Calculator, Clock, Undo2, Wallet, History } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useMoney, toast, confirm } from '@/composables'
import { formatDateTime, formatTime, formatDate, duration, round2 } from '@/utils/format'
import { DENOMS, floatPresets } from '@/utils/constants'
import BaseModal from '@/components/BaseModal.vue'
import AnimatedNumber from '@/components/AnimatedNumber.vue'

const pos = usePos()
const money = useMoney()
const now = ref(Date.now())
let timer
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 30000)))
onBeforeUnmount(() => clearInterval(timer))

const shift = computed(() => pos.activeShift)
// accountants can look but not touch the drawer
const canManage = computed(() => pos.can('shifts'))
const sum = computed(() => (shift.value ? pos.shiftSummary(shift.value) : null))
const history = computed(() => pos.shifts.filter((s) => s.closedAt))

/* open */
const float = ref(pos.settings.defaultFloat)
const openNote = ref('')
const presets = computed(() => floatPresets(pos.settings.currency, pos.settings.defaultFloat))
function open() {
  pos.openShift(Number(float.value) || 0, openNote.value)
  toast('Shift opened')
}

/* cash in / out */
const showMove = ref(false)
const move = ref({ type: 'in', amount: '', reason: '' })
function startMove(type) {
  move.value = { type, amount: '', reason: '' }
  showMove.value = true
}
function saveMove() {
  const amt = Number(move.value.amount)
  if (!(amt > 0)) return toast('Enter an amount', 'warning')
  pos.addCashMovement(move.value.type, amt, move.value.reason || (move.value.type === 'in' ? 'Cash added' : 'Paid out'))
  toast(`${move.value.type === 'in' ? 'Added' : 'Removed'} ${money(amt)}`)
  showMove.value = false
}

/* close */
const showClose = ref(false)
const counted = ref('')
const closeNote = ref('')
const useDenoms = ref(false)
const denoms = computed(() => DENOMS[pos.settings.currency] || DENOMS.USD)
const counts = ref({})
const denomTotal = computed(() => round2(denoms.value.reduce((s, d) => s + d * (Number(counts.value[d]) || 0), 0)))
const countedValue = computed(() => (useDenoms.value ? denomTotal.value : Number(counted.value) || 0))
const diff = computed(() => round2(countedValue.value - (sum.value?.expected || 0)))
function startClose() {
  counted.value = ''
  closeNote.value = ''
  counts.value = {}
  useDenoms.value = false
  showClose.value = true
}
async function closeIt() {
  if (Math.abs(diff.value) > 0.009) {
    const ok = await confirm({
      title: diff.value > 0 ? 'Drawer is over' : 'Drawer is short',
      message: `Counted cash differs from expected by ${money(Math.abs(diff.value))}. Close the shift anyway?`,
      confirmText: 'Close shift',
      danger: diff.value < 0,
    })
    if (!ok) return
  }
  pos.closeShift(countedValue.value, closeNote.value)
  showClose.value = false
  toast('Shift closed · drawer reconciled')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Cash & Shifts</h1>
        <p>{{ canManage ? 'Open the drawer, track cash in and out, and reconcile at close.' : 'Cash drawer activity and reconciliation, read-only.' }}</p>
      </div>
      <span v-if="!canManage" class="badge">Read-only</span>
    </div>

    <Transition name="slide" mode="out-in">
      <!-- read-only view with no open shift -->
      <section v-if="!shift && !canManage" key="ro" class="card card-pad rise empty">
        <div class="empty-icon"><Banknote :size="26" /></div>
        <strong>No shift is open right now</strong>
        <span class="small">Closed shifts and their cash variance are listed below.</span>
      </section>

      <!-- no shift -->
      <section v-else-if="!shift" key="closed" class="open-card card card-glow rise">
        <div class="oc-art">
          <div class="drawer"><Banknote :size="40" /></div>
        </div>
        <div class="oc-form">
          <span class="badge"><span class="dot"></span> Drawer closed</span>
          <h2>Start a new shift</h2>
          <p class="muted">Count the float in the drawer before your first sale.</p>
          <label class="field">
            <span class="label">Opening float</span>
            <input v-model.number="float" class="input input-lg" type="number" min="0" step="0.01" />
          </label>
          <div class="row wrap">
            <button v-for="v in presets" :key="v" class="chip" :class="{ active: float === v }" @click="float = v">{{ money(v) }}</button>
          </div>
          <label class="field"><span class="label">Note (optional)</span><input v-model="openNote" class="input" placeholder="e.g. Morning shift" /></label>
          <button class="btn btn-primary btn-lg" @click="open"><CirclePlay :size="18" /> Open shift</button>
        </div>
      </section>

      <!-- active shift -->
      <div v-else key="open" class="stack">
        <section class="live card rise">
          <div class="live-head">
            <div class="row">
              <span class="pulse"></span>
              <div>
                <h2>Shift in progress</h2>
                <span class="muted small">Opened {{ formatDateTime(shift.openedAt) }} by {{ pos.staffMap[shift.staffId]?.name || '—' }} · {{ duration(now - shift.openedAt) }}</span>
              </div>
            </div>
            <div v-if="canManage" class="row wrap">
              <button class="btn btn-success" @click="startMove('in')"><ArrowDownToLine :size="16" /> Cash in</button>
              <button class="btn" @click="startMove('out')"><ArrowUpFromLine :size="16" /> Cash out</button>
              <button class="btn btn-primary" @click="startClose"><CircleStop :size="16" /> Close shift</button>
            </div>
          </div>
          <div class="expected">
            <span class="eyebrow">Expected in drawer</span>
            <strong class="gradient-text"><AnimatedNumber :value="sum.expected" :format="money" /></strong>
            <span class="muted small">Float {{ money(shift.openingFloat) }} + cash sales {{ money(sum.sales.cash) }} + in {{ money(sum.cashIn) }} − out {{ money(sum.cashOut) }} − refunds {{ money(sum.cashRefunds) }}</span>
          </div>
        </section>

        <div class="tiles">
          <div class="tile card rise" style="--i: 1; --t: #22c55e"><span class="t-ico"><Banknote :size="18" /></span><span class="muted small">Cash sales</span><b class="num">{{ money(sum.sales.cash) }}</b></div>
          <div class="tile card rise" style="--i: 2; --t: #8b5cf6"><span class="t-ico"><CreditCard :size="18" /></span><span class="muted small">Card</span><b class="num">{{ money(sum.sales.card) }}</b></div>
          <div class="tile card rise" style="--i: 3; --t: #22d3ee"><span class="t-ico"><Smartphone :size="18" /></span><span class="muted small">Mobile</span><b class="num">{{ money(sum.sales.mobile) }}</b></div>
          <div class="tile card rise" style="--i: 4; --t: #f59e0b"><span class="t-ico"><Wallet :size="18" /></span><span class="muted small">Orders</span><b class="num">{{ sum.orders }} · {{ money(sum.total) }}</b></div>
          <div class="tile card rise" style="--i: 5; --t: #f43f5e"><span class="t-ico"><Undo2 :size="18" /></span><span class="muted small">Refunds</span><b class="num">{{ money(sum.refunds) }}</b></div>
        </div>

        <section class="card card-pad rise" style="--i: 6">
          <div class="card-head"><div><div class="card-title">Drawer activity</div><div class="card-sub">Pay-ins, pay-outs and drops this shift</div></div></div>
          <TransitionGroup v-if="shift.movements.length" name="list" tag="ul" class="moves">
            <li v-for="m in [...shift.movements].reverse()" :key="m.id">
              <span class="m-ico" :class="m.type"><ArrowDownToLine v-if="m.type === 'in'" :size="15" /><ArrowUpFromLine v-else :size="15" /></span>
              <div class="grow"><strong>{{ m.reason }}</strong><span class="muted tiny">{{ formatTime(m.at) }} · {{ pos.staffMap[m.by]?.name || '—' }}</span></div>
              <b class="num" :class="m.type === 'in' ? 'c-success' : 'c-danger'">{{ m.type === 'in' ? '+' : '−' }}{{ money(m.amount) }}</b>
            </li>
          </TransitionGroup>
          <div v-else class="empty small"><Clock :size="20" /> No cash movements yet</div>
        </section>
      </div>
    </Transition>

    <section class="card mt rise" style="--i: 7">
      <div class="card-head card-pad" style="margin-bottom: 0; padding-bottom: 6px">
        <div><div class="card-title">Shift history</div><div class="card-sub">Closed shifts and their cash variance</div></div>
        <History :size="18" class="muted" />
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Date</th><th class="hide-sm">Hours</th><th class="hide-sm">Staff</th><th class="right">Sales</th><th class="right hide-sm">Expected</th><th class="right">Counted</th><th class="right">Variance</th></tr></thead>
          <tbody>
            <tr v-for="h in history" :key="h.id">
              <td class="bold">{{ formatDate(h.openedAt) }}</td>
              <td class="hide-sm muted">{{ formatTime(h.openedAt) }} – {{ formatTime(h.closedAt) }}</td>
              <td class="hide-sm">{{ pos.staffMap[h.staffId]?.name || '—' }}</td>
              <td class="right num">{{ money(pos.shiftSummary(h).total) }}</td>
              <td class="right num hide-sm">{{ money(h.expected) }}</td>
              <td class="right num">{{ money(h.counted) }}</td>
              <td class="right">
                <span class="badge" :class="Math.abs(h.difference) < 0.01 ? 'b-success' : h.difference > 0 ? 'b-info' : 'b-danger'">
                  {{ Math.abs(h.difference) < 0.01 ? 'Balanced' : (h.difference > 0 ? '+' : '−') + money(Math.abs(h.difference)) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!history.length" class="empty small">No closed shifts yet</div>
      </div>
    </section>

    <BaseModal v-model:open="showMove" size="sm" :title="move.type === 'in' ? 'Cash in' : 'Cash out'" :subtitle="move.type === 'in' ? 'Add change or extra float to the drawer' : 'Supplier payment, petty cash or a safe drop'">
      <div class="stack">
        <input v-model="move.amount" class="input input-lg" type="number" min="0" step="0.01" placeholder="Amount" autofocus @keydown.enter="saveMove" />
        <input v-model="move.reason" class="input" :placeholder="move.type === 'in' ? 'Reason (e.g. extra coins)' : 'Reason (e.g. supplier payment)'" @keydown.enter="saveMove" />
      </div>
      <template #footer>
        <button class="btn" @click="showMove = false">Cancel</button>
        <button class="btn btn-primary" @click="saveMove">Record</button>
      </template>
    </BaseModal>

    <BaseModal v-model:open="showClose" size="md" title="Close shift" subtitle="Count the drawer and record what's there">
      <div v-if="sum" class="stack">
        <div class="recon">
          <div><span class="muted small">Expected</span><b class="num">{{ money(sum.expected) }}</b></div>
          <div><span class="muted small">Counted</span><b class="num">{{ money(countedValue) }}</b></div>
          <div :class="Math.abs(diff) < 0.01 ? 'ok' : diff > 0 ? 'over' : 'short'">
            <span class="small">{{ Math.abs(diff) < 0.01 ? 'Balanced' : diff > 0 ? 'Over' : 'Short' }}</span>
            <b class="num">{{ money(Math.abs(diff)) }}</b>
          </div>
        </div>
        <label class="switch"><input v-model="useDenoms" type="checkbox" /><span class="track"></span><Calculator :size="15" /> Count by denomination</label>
        <Transition name="fade" mode="out-in">
          <div v-if="useDenoms" key="d" class="denoms">
            <label v-for="d in denoms" :key="d" class="denom">
              <span class="num">{{ money(d) }}</span>
              <input v-model="counts[d]" class="input" type="number" min="0" placeholder="0" />
              <span class="muted tiny num">{{ money(d * (Number(counts[d]) || 0)) }}</span>
            </label>
          </div>
          <input v-else key="c" v-model="counted" class="input input-lg" type="number" min="0" step="0.01" placeholder="Counted cash total" />
        </Transition>
        <input v-model="closeNote" class="input" placeholder="Closing note (optional)" />
      </div>
      <template #footer>
        <button class="btn" @click="showClose = false">Cancel</button>
        <button class="btn btn-primary" @click="closeIt"><CircleStop :size="16" /> Close shift</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.open-card { display: grid; grid-template-columns: 1fr 1.2fr; overflow: hidden; border-radius: 26px; }
.oc-art { position: relative; display: grid; place-items: center; min-height: 320px; background: var(--grad); background-size: 200% 200%; animation: gradientShift 10s ease infinite; }
.oc-art::before, .oc-art::after { content: ''; position: absolute; border-radius: 50%; background: rgba(255, 255, 255, .14); }
.oc-art::before { width: 240px; height: 240px; top: -60px; left: -50px; animation: floaty 8s ease-in-out infinite; }
.oc-art::after { width: 140px; height: 140px; bottom: -30px; right: 30px; animation: floaty 6s ease-in-out -2s infinite; }
.drawer { position: relative; z-index: 1; width: 110px; height: 110px; border-radius: 32px; display: grid; place-items: center; color: #fff; background: rgba(255, 255, 255, .18); border: 1px solid rgba(255, 255, 255, .35); backdrop-filter: blur(8px); animation: floaty 4s ease-in-out infinite; }
.oc-form { display: flex; flex-direction: column; gap: 14px; padding: 32px; }
.oc-form h2 { font-size: 24px; font-weight: 800; }
.oc-form .badge { align-self: flex-start; }

.live { padding: 22px; overflow: hidden; }
.live-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.live-head h2 { font-size: 19px; font-weight: 800; }
.pulse { width: 12px; height: 12px; border-radius: 50%; background: var(--success); color: var(--success); animation: pulseRing 1.6s ease-out infinite; flex-shrink: 0; }
.expected { margin-top: 22px; padding: 22px; border-radius: 20px; background: var(--grad-soft); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 4px; }
.expected strong { font-size: 44px; font-weight: 800; letter-spacing: -.04em; line-height: 1.1; }
.tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
.tile { display: flex; flex-direction: column; gap: 4px; padding: 16px; }
.tile b { font-size: 17px; font-weight: 800; }
.t-ico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; margin-bottom: 6px; color: var(--t); background: color-mix(in srgb, var(--t) 16%, transparent); }
.moves { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; position: relative; }
.moves li { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 12px; background: var(--surface-2); }
.moves .grow { display: flex; flex-direction: column; line-height: 1.3; }
.m-ico { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; }
.m-ico.in { color: var(--success); background: color-mix(in srgb, var(--success) 15%, transparent); }
.m-ico.out { color: var(--danger); background: color-mix(in srgb, var(--danger) 15%, transparent); }

.recon { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.recon > div { display: flex; flex-direction: column; padding: 12px 14px; border-radius: 14px; background: var(--surface-2); }
.recon b { font-size: 18px; font-weight: 800; }
.recon .ok { background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--success); }
.recon .over { background: color-mix(in srgb, var(--info) 14%, transparent); color: var(--info); }
.recon .short { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
.denoms { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; max-height: 300px; overflow-y: auto; }
.denom { display: grid; grid-template-columns: 76px 1fr; grid-template-rows: auto auto; align-items: center; column-gap: 10px; padding: 8px 10px; border-radius: 12px; background: var(--surface-2); }
.denom .input { height: 36px; grid-row: span 2; }
.denom span:first-child { font-weight: 750; }
@media (max-width: 1100px) {
  .tiles { grid-template-columns: repeat(2, 1fr); }
  .open-card { grid-template-columns: 1fr; }
  .oc-art { min-height: 180px; }
}
</style>

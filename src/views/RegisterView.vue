<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  Search, X, Minus, Plus, Trash2, UserPlus, Percent, CirclePause, ListRestart, StickyNote, Gift,
  ShoppingBag, Printer, Wallet, Check, Star, ScanBarcode, Banknote, CirclePlay,
} from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useMoney, toast, confirm, isModalOpen } from '@/composables'
import { initials, timeAgo, round2, itemsSummary } from '@/utils/format'
import { floatPresets } from '@/utils/constants'
import BaseModal from '@/components/BaseModal.vue'
import PaymentModal from '@/components/PaymentModal.vue'
import CustomerPicker from '@/components/CustomerPicker.vue'
import ReceiptPaper from '@/components/ReceiptPaper.vue'
import AnimatedNumber from '@/components/AnimatedNumber.vue'
import ItemIcon from '@/components/ItemIcon.vue'

const pos = usePos()
const money = useMoney()

const query = ref('')
const cat = ref(null)
const searchEl = ref(null)
const cartEl = ref(null)
const fabEl = ref(null)
const cartOpen = ref(false)

const showPay = ref(false)
const showCustomer = ref(false)
const showDiscount = ref(false)
const showHeld = ref(false)
const showNote = ref(false)
const showLine = ref(false)
const showReceipt = ref(false)
const lastOrder = ref(null)

const products = computed(() => pos.products.filter((p) => p.active))
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return products.value.filter(
    (p) =>
      (!cat.value || p.categoryId === cat.value) &&
      (!q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '').includes(q)),
  )
})
const catCount = (id) => products.value.filter((p) => p.categoryId === id).length
const catColor = (p) => pos.categoryMap[p.categoryId]?.color || '#8b5cf6'
const qtyOf = (id) => pos.qtyInCart(id)
function stockState(p) {
  if (!p.trackStock) return 'na'
  const left = p.stock - qtyOf(p.id)
  if (p.stock <= 0) return 'out'
  if (left <= 0) return 'maxed'
  if (left <= pos.settings.lowStockThreshold) return 'low'
  return 'ok'
}

// below this width the cart is a drawer / sheet and the checkout bar is shown
const COMPACT = 980
const PHONE = 860
function buzz(ms = 8) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // not supported
  }
}

function add(p, ev) {
  const r = pos.addToCart(p)
  if (!r.ok) {
    buzz([20, 40, 20])
    return toast(r.message, 'warning')
  }
  buzz()
  if (ev?.currentTarget) fly(catColor(p), ev.currentTarget)
}

/* phone cart sheet: drag the handle down to close it */
const dragY = ref(0)
let dragStartY = null
function dragStart(e) {
  if (window.innerWidth > PHONE) return
  dragStartY = e.clientY
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function dragMove(e) {
  if (dragStartY === null) return
  dragY.value = Math.max(0, e.clientY - dragStartY)
}
function dragEnd() {
  if (dragStartY === null) return
  if (dragY.value > 110) cartOpen.value = false
  dragStartY = null
  dragY.value = 0
}
const sheetStyle = computed(() => (dragY.value ? { transform: `translateY(${dragY.value}px)`, transition: 'none' } : undefined))

// Small dot that travels from the tapped tile to the cart.
function fly(color, src) {
  const target = window.innerWidth <= COMPACT ? fabEl.value : cartEl.value
  if (!target || !src.getBoundingClientRect || !document.body.animate) return
  const s = src.getBoundingClientRect()
  const t = target.getBoundingClientRect()
  const el = document.createElement('div')
  el.className = 'fly-dot'
  el.style.background = color
  document.body.appendChild(el)
  const x0 = s.left + s.width / 2 - 20
  const y0 = s.top + s.height / 2 - 20
  const x1 = t.left + t.width / 2 - 20
  const y1 = window.innerWidth <= COMPACT ? t.top : t.top + 120
  const anim = el.animate(
    [
      { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 90}px) scale(1.3) rotate(-12deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) scale(.3) rotate(10deg)`, opacity: 0 },
    ],
    { duration: 720, easing: 'cubic-bezier(.45, 0, .25, 1)' },
  )
  anim.onfinish = () => el.remove()
}
function onSearchEnter() {
  const q = query.value.trim().toLowerCase()
  if (!q) return
  const exact = products.value.find((p) => p.barcode === q || (p.sku || '').toLowerCase() === q)
  const hit = exact || (filtered.value.length === 1 ? filtered.value[0] : null)
  if (!hit) return toast(filtered.value.length ? 'Several matches — tap the right product' : 'No product matches that code', 'warning')
  const r = pos.addToCart(hit)
  if (!r.ok) return toast(r.message, 'warning')
  toast(`${hit.name} added`, 'success', 1400)
  query.value = ''
}

const totals = computed(() => pos.cartTotals)
const cust = computed(() => pos.cartCustomer)
const hasItems = computed(() => pos.cart.items.length > 0)
const canRedeem = computed(() => pos.settings.loyaltyEnabled && cust.value && cust.value.points > 0 && hasItems.value)

function inc(l) {
  const r = pos.setQty(l.key, l.qty + 1)
  if (!r.ok) toast(r.message, 'warning')
}
function dec(l) {
  pos.setQty(l.key, l.qty - 1)
}
async function clearSale() {
  if (!hasItems.value) return
  if (await confirm({ title: 'Clear this sale?', message: 'All items, discounts and the attached customer will be removed.', confirmText: 'Clear sale', danger: true })) {
    pos.clearCart()
    toast('Sale cleared', 'info')
  }
}
function toggleRedeem() {
  if (!canRedeem.value) return
  pos.cart.redeemPoints = pos.cart.redeemPoints > 0 ? 0 : cust.value.points
}
function holdSale() {
  if (!hasItems.value) return
  const h = pos.holdCart()
  toast(`Sale parked as “${h.label}”`, 'info')
}
function resume(h) {
  pos.resumeHeld(h.id)
  showHeld.value = false
  toast(`Resumed “${h.label}”`)
}

/* line editor */
const lineDraft = ref(null)
function openLine(l) {
  lineDraft.value = { key: l.key, name: l.name, price: l.price, qty: l.qty, discount: l.discount || 0 }
  showLine.value = true
}
function saveLine() {
  const d = lineDraft.value
  const r = pos.setQty(d.key, d.qty)
  if (!r.ok) return toast(r.message, 'warning')
  pos.updateLine(d.key, { discount: Math.min(100, Math.max(0, Number(d.discount) || 0)) })
  showLine.value = false
}
function removeLine() {
  pos.removeLine(lineDraft.value.key)
  showLine.value = false
}

/* order discount */
const discDraft = ref({ type: 'percent', value: 0 })
function openDiscount() {
  if (!hasItems.value) return
  discDraft.value = { ...pos.cart.discount }
  showDiscount.value = true
}
function applyDiscount() {
  const v = Math.max(0, Number(discDraft.value.value) || 0)
  if (discDraft.value.type === 'percent' && v > 100) return toast('Percent discount can’t exceed 100%', 'warning')
  pos.cart.discount = { type: discDraft.value.type, value: v }
  showDiscount.value = false
  if (v) toast('Discount applied')
}

/* note */
const noteDraft = ref('')
function openNote() {
  noteDraft.value = pos.cart.note
  showNote.value = true
}
function saveNote() {
  pos.cart.note = noteDraft.value.trim()
  showNote.value = false
}

/* shift gate */
const needShift = computed(() => pos.settings.requireShift && !pos.activeShift)
const floatDraft = ref(pos.settings.defaultFloat)
const presets = computed(() => floatPresets(pos.settings.currency, pos.settings.defaultFloat))
function startShift() {
  pos.openShift(Number(floatDraft.value) || 0)
  toast('Shift opened')
}

/* payment */
function openPay() {
  if (!hasItems.value || needShift.value) return
  showPay.value = true
}
function onPaid(payments) {
  try {
    lastOrder.value = pos.checkout(payments)
    showPay.value = false
    cartOpen.value = false
    setTimeout(() => (showReceipt.value = true), 180)
  } catch (e) {
    toast(e.message, 'error')
  }
}
function printReceipt() {
  window.print()
}

/* keyboard */
function onKey(e) {
  if (isModalOpen()) return
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
  if (e.key === '/' && !typing) {
    e.preventDefault()
    searchEl.value?.focus()
  } else if (e.key === 'F2') {
    e.preventDefault()
    openPay()
  } else if (e.key === 'F4') {
    e.preventDefault()
    holdSale()
  } else if (e.key === 'Escape' && document.activeElement === searchEl.value) {
    query.value = ''
    searchEl.value.blur()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="register">
    <section class="catalog">
      <div class="search input-icon">
        <Search :size="18" />
        <input ref="searchEl" v-model="query" class="input input-lg" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search products or scan a barcode…" @keydown.enter.prevent="onSearchEnter" />
        <button v-if="query" class="icon-btn xs clear" aria-label="Clear search" @click="query = ''"><X :size="13" /></button>
        <span v-else class="scan-hint hide-sm hide-touch"><ScanBarcode :size="15" /><kbd>/</kbd></span>
      </div>

      <div class="chips-row">
        <button class="chip" :class="{ active: !cat }" @click="cat = null">All <span class="cnt">{{ products.length }}</span></button>
        <button v-for="c in pos.categories" :key="c.id" class="chip" :class="{ active: cat === c.id }" @click="cat = c.id">
          <ItemIcon :name="c.icon" :label="c.name" :size="15" /> {{ c.name }} <span class="cnt">{{ catCount(c.id) }}</span>
        </button>
      </div>

      <div class="tiles-scroll">
        <TransitionGroup tag="div" name="tile" class="tiles" appear>
          <button
            v-for="(p, i) in filtered"
            :key="p.id"
            class="tile"
            :class="'s-' + stockState(p)"
            :style="{ '--cat': catColor(p), '--i': Math.min(i, 24) }"
            :disabled="stockState(p) === 'out'"
            @click="add(p, $event)"
          >
            <span class="tile-icon"><ItemIcon :name="p.icon" :label="p.name" :size="26" /></span>
            <span class="tile-name">{{ p.name }}</span>
            <span class="tile-foot">
              <span class="tile-price num">{{ money(p.price) }}</span>
              <span v-if="p.trackStock" class="tile-stock">{{ p.stock <= 0 ? 'Sold out' : `${Math.max(0, p.stock - qtyOf(p.id))} left` }}</span>
            </span>
            <Transition name="pop">
              <span v-if="qtyOf(p.id)" :key="qtyOf(p.id)" class="tile-qty">{{ qtyOf(p.id) }}</span>
            </Transition>
          </button>
        </TransitionGroup>
        <div v-if="!products.length" class="empty">
          <div class="empty-icon"><ShoppingBag :size="26" /></div>
          <strong>No products to sell yet</strong>
          <span class="small">{{ pos.can('products') ? 'Add your products in Inventory and they will appear here.' : 'Ask a manager to add products in Inventory.' }}</span>
          <RouterLink v-if="pos.can('products')" :to="{ path: '/products', query: { new: '1' } }" class="btn btn-primary btn-sm mt"><Plus :size="15" /> Add a product</RouterLink>
        </div>
        <div v-else-if="!filtered.length" class="empty">
          <div class="empty-icon"><Search :size="26" /></div>
          <strong>No products found</strong>
          <span class="small">Try another search or category.</span>
        </div>
      </div>
    </section>

    <Transition name="fade"><div v-if="cartOpen" class="cart-scrim" @click="cartOpen = false"></div></Transition>
    <aside ref="cartEl" class="cart card" :class="{ open: cartOpen }" :style="sheetStyle">
      <div class="grab" @pointerdown="dragStart" @pointermove="dragMove" @pointerup="dragEnd" @pointercancel="dragEnd">
        <span class="handle"></span>
      </div>
      <header class="cart-head">
        <div class="grab-title" @pointerdown="dragStart" @pointermove="dragMove" @pointerup="dragEnd" @pointercancel="dragEnd">
          <h3>Current sale</h3>
          <span class="muted small mono">Order #{{ pos.counters.order + 1 }}</span>
        </div>
        <div class="row" style="gap: 6px">
          <button class="icon-btn" title="Parked sales" @click="showHeld = true">
            <ListRestart :size="17" />
            <Transition name="pop"><span v-if="pos.held.length" class="mini-badge">{{ pos.held.length }}</span></Transition>
          </button>
          <button class="icon-btn danger" title="Clear sale" :disabled="!hasItems" @click="clearSale"><Trash2 :size="17" /></button>
          <button class="icon-btn close-cart" aria-label="Close cart" @click="cartOpen = false"><X :size="17" /></button>
        </div>
      </header>

      <button class="customer" :class="{ has: cust }" @click="showCustomer = true">
        <template v-if="cust">
          <div class="avatar" style="--s: 40px">{{ initials(cust.name) }}</div>
          <div class="grow">
            <strong class="ellipsis">{{ cust.name }}</strong>
            <span class="muted small"><Star :size="11" class="inline" /> {{ cust.points }} pts · {{ cust.visits }} visits</span>
          </div>
          <span class="icon-btn xs" role="button" aria-label="Remove customer" @click.stop="pos.setCustomer(null)"><X :size="12" /></span>
        </template>
        <template v-else>
          <span class="c-ico"><UserPlus :size="18" /></span>
          <div class="grow">
            <strong>Add customer</strong>
            <span class="muted small">Earn loyalty points on this sale</span>
          </div>
        </template>
      </button>

      <div class="lines">
        <TransitionGroup name="line" tag="div" class="lines-inner">
          <div v-for="l in totals.lines" :key="l.key" class="line">
            <button class="line-main" @click="openLine(l)">
              <span class="line-icon" :style="{ '--cat': pos.categoryMap[l.categoryId]?.color || '#8b5cf6' }"><ItemIcon :name="l.icon" :label="l.name" :size="19" /></span>
              <span class="line-text">
                <span class="line-name ellipsis">{{ l.name }}</span>
                <span class="muted tiny">{{ money(l.price) }} each<span v-if="l.discount" class="disc"> · −{{ l.discount }}%</span></span>
              </span>
            </button>
            <div class="stepper">
              <button aria-label="Decrease" @click="dec(l)"><Minus :size="13" /></button>
              <Transition name="pop" mode="out-in"><span :key="l.qty" class="mono">{{ l.qty }}</span></Transition>
              <button aria-label="Increase" @click="inc(l)"><Plus :size="13" /></button>
            </div>
            <span class="line-total num">{{ money(l.net) }}</span>
          </div>
        </TransitionGroup>
        <div v-if="!hasItems" class="cart-empty">
          <div class="bag"><ShoppingBag :size="30" /></div>
          <strong>Cart is empty</strong>
          <span class="muted small">Tap a product or scan a barcode to start.</span>
          <div class="shortcuts muted tiny hide-touch">
            <span><kbd>/</kbd> search</span><span><kbd>F2</kbd> pay</span><span><kbd>F4</kbd> park</span>
          </div>
        </div>
      </div>

      <footer class="cart-foot">
        <div class="quick-actions">
          <button class="qa" :class="{ on: pos.cart.discount.value > 0 }" :disabled="!hasItems" @click="openDiscount"><Percent :size="16" /><span>Discount</span></button>
          <button class="qa" :class="{ on: pos.cart.note }" @click="openNote"><StickyNote :size="16" /><span>Note</span></button>
          <button class="qa" :class="{ on: pos.cart.redeemPoints > 0 }" :disabled="!canRedeem" @click="toggleRedeem"><Gift :size="16" /><span>Points</span></button>
          <button class="qa" :disabled="!hasItems" @click="holdSale"><CirclePause :size="16" /><span>Park</span></button>
        </div>
        <div class="sums">
          <div class="sum"><span>Subtotal</span><span class="num">{{ money(totals.subtotal) }}</span></div>
          <Transition name="fade">
            <div v-if="totals.discountTotal" class="sum disc">
              <span>Discounts<template v-if="totals.pointsRedeemed"> · {{ totals.pointsRedeemed }} pts</template></span>
              <span class="num">−{{ money(totals.discountTotal) }}</span>
            </div>
          </Transition>
          <div class="sum"><span>Tax {{ pos.settings.taxRate }}%{{ pos.settings.taxInclusive ? ' (incl.)' : '' }}</span><span class="num">{{ money(totals.tax) }}</span></div>
          <div class="sum total"><span>Total</span><AnimatedNumber :value="totals.total" :format="money" :duration="450" /></div>
        </div>
        <button class="btn btn-primary btn-xl charge" :disabled="!hasItems || needShift" @click="openPay">
          <Wallet :size="20" /> Charge {{ money(totals.total) }} <kbd class="hide-sm hide-touch">F2</kbd>
        </button>
      </footer>
    </aside>

    <!-- compact screens: checkout bar in place of the side cart -->
    <Transition name="bar">
      <div v-if="!needShift" ref="fabEl" class="cart-bar" :class="{ empty: !hasItems }">
        <button class="cb-cart" :aria-label="`Open cart, ${pos.cartCount} items`" @click="cartOpen = true">
          <span class="cb-ico">
            <ShoppingBag :size="20" />
            <Transition name="pop"><span v-if="pos.cartCount" :key="pos.cartCount" class="cb-count">{{ pos.cartCount }}</span></Transition>
          </span>
          <span class="cb-text">
            <AnimatedNumber class="cb-total num" :value="totals.total" :format="money" :duration="350" />
            <small>{{ hasItems ? `${pos.cartCount} item${pos.cartCount === 1 ? '' : 's'} · View cart` : 'Tap a product to start' }}</small>
          </span>
        </button>
        <button class="btn btn-primary cb-pay" :disabled="!hasItems" @click="openPay"><Wallet :size="18" /> Charge</button>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="needShift" class="gate">
        <div class="gate-card card card-glow">
          <div class="gate-ico"><Banknote :size="30" /></div>
          <h2>Open the drawer to start selling</h2>
          <p class="muted">Count the cash float in the drawer. It's used to reconcile cash when the shift closes.</p>
          <label class="field">
            <span class="label">Opening float</span>
            <input v-model.number="floatDraft" class="input input-lg center" type="number" min="0" step="0.01" @keydown.enter="startShift" />
          </label>
          <div class="row wrap" style="justify-content: center">
            <button v-for="v in presets" :key="v" class="chip" :class="{ active: floatDraft === v }" @click="floatDraft = v">{{ money(v) }}</button>
          </div>
          <button class="btn btn-primary btn-lg btn-block" @click="startShift"><CirclePlay :size="18" /> Open shift</button>
        </div>
      </div>
    </Transition>

    <PaymentModal v-model:open="showPay" :total="totals.total" @complete="onPaid" />
    <CustomerPicker v-model:open="showCustomer" @select="(id) => pos.setCustomer(id)" />

    <BaseModal v-model:open="showLine" size="sm" :title="lineDraft?.name" :subtitle="lineDraft ? money(lineDraft.price) + ' each' : ''">
      <div v-if="lineDraft" class="stack">
        <div class="field">
          <span class="label">Quantity</span>
          <div class="big-stepper">
            <button class="icon-btn" @click="lineDraft.qty = Math.max(1, lineDraft.qty - 1)"><Minus :size="16" /></button>
            <input v-model.number="lineDraft.qty" class="input center num" type="number" min="1" />
            <button class="icon-btn" @click="lineDraft.qty++"><Plus :size="16" /></button>
          </div>
        </div>
        <div class="field">
          <span class="label">Line discount (%)</span>
          <input v-model.number="lineDraft.discount" class="input" type="number" min="0" max="100" />
          <div class="row wrap">
            <button v-for="v in [0, 5, 10, 25, 50, 100]" :key="v" class="chip" :class="{ active: lineDraft.discount === v }" @click="lineDraft.discount = v">{{ v === 100 ? 'Free' : v + '%' }}</button>
          </div>
        </div>
        <div class="line-preview">
          <span class="muted">Line total</span>
          <strong class="num">{{ money(round2(lineDraft.price * lineDraft.qty * (1 - (Number(lineDraft.discount) || 0) / 100))) }}</strong>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-danger" @click="removeLine"><Trash2 :size="15" /> Remove</button>
        <span class="grow"></span>
        <button class="btn btn-primary" @click="saveLine"><Check :size="16" /> Update</button>
      </template>
    </BaseModal>

    <BaseModal v-model:open="showDiscount" size="sm" title="Order discount" subtitle="Applied after line discounts, before tax">
      <div class="stack">
        <div class="segmented" style="align-self: flex-start">
          <button :class="{ active: discDraft.type === 'percent' }" @click="discDraft.type = 'percent'">Percent %</button>
          <button :class="{ active: discDraft.type === 'amount' }" @click="discDraft.type = 'amount'">Fixed amount</button>
        </div>
        <input v-model.number="discDraft.value" class="input input-lg" type="number" min="0" :placeholder="discDraft.type === 'percent' ? 'e.g. 10' : 'e.g. 5.00'" @keydown.enter="applyDiscount" />
        <div v-if="discDraft.type === 'percent'" class="row wrap">
          <button v-for="v in [5, 10, 15, 20, 25, 50]" :key="v" class="chip" :class="{ active: discDraft.value === v }" @click="discDraft.value = v">{{ v }}%</button>
        </div>
      </div>
      <template #footer>
        <button class="btn" @click="discDraft.value = 0; applyDiscount()">Remove</button>
        <button class="btn btn-primary" @click="applyDiscount"><Percent :size="15" /> Apply</button>
      </template>
    </BaseModal>

    <BaseModal v-model:open="showNote" size="sm" title="Order note" subtitle="Printed on the receipt">
      <textarea v-model="noteDraft" class="textarea" rows="4" placeholder="e.g. Oat milk, extra hot" maxlength="200"></textarea>
      <template #footer>
        <button class="btn" @click="showNote = false">Cancel</button>
        <button class="btn btn-primary" @click="saveNote"><Check :size="16" /> Save note</button>
      </template>
    </BaseModal>

    <BaseModal v-model:open="showHeld" size="md" title="Parked sales" subtitle="Resume a sale exactly where you left it">
      <TransitionGroup v-if="pos.held.length" name="list" tag="div" class="held-list">
        <div v-for="h in pos.held" :key="h.id" class="held">
          <div class="held-icon"><CirclePause :size="18" /></div>
          <div class="grow">
            <strong>{{ h.label }}</strong>
            <span class="muted small ellipsis">{{ itemsSummary(h.cart.items) }} · {{ h.count }} items · {{ timeAgo(h.createdAt) }}</span>
          </div>
          <strong class="num">{{ money(h.total) }}</strong>
          <button class="icon-btn sm danger" title="Discard" @click="pos.deleteHeld(h.id)"><Trash2 :size="14" /></button>
          <button class="btn btn-soft btn-sm" @click="resume(h)">Resume</button>
        </div>
      </TransitionGroup>
      <div v-else class="empty">
        <div class="empty-icon"><CirclePause :size="26" /></div>
        <strong>No parked sales</strong>
        <span class="small">Use <kbd>F4</kbd> or “Park” to set a sale aside.</span>
      </div>
    </BaseModal>

    <BaseModal v-model:open="showReceipt" size="md">
      <div v-if="lastOrder" class="success">
        <svg class="check" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" />
          <path d="M15 27l7 7 15-15" />
        </svg>
        <h2>Payment complete</h2>
        <p class="muted">Order #{{ lastOrder.number }} · {{ money(lastOrder.total) }}</p>
        <div v-if="lastOrder.change > 0" class="change-due">
          <span>Change due</span>
          <strong class="num">{{ money(lastOrder.change) }}</strong>
        </div>
        <div v-if="lastOrder.pointsEarned" class="badge b-primary"><Star :size="12" /> +{{ lastOrder.pointsEarned }} loyalty points earned</div>
        <div class="receipt-wrap"><ReceiptPaper :order="lastOrder" /></div>
      </div>
      <template #footer>
        <button class="btn" @click="printReceipt"><Printer :size="16" /> Print receipt</button>
        <button class="btn btn-primary" @click="showReceipt = false"><Plus :size="16" /> New sale</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.register { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) clamp(330px, 30vw, 440px); gap: clamp(14px, 1.6vw, 22px); height: 100%; max-width: 1760px; margin: 0 auto; }
.search .input::-webkit-search-cancel-button { display: none; }
.search > svg { z-index: 1; }
/* the cart lays its lines out by its own width, not the screen's */
.cart { container-type: inline-size; }
@container (max-width: 400px) {
  .cart .line { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'main main' 'step total'; row-gap: 8px; padding: 10px; }
  .cart .line-main { grid-area: main; }
  .cart .stepper { grid-area: step; justify-self: start; }
  .cart .line-total { grid-area: total; font-size: 14.5px; }
}

/* catalog */
.catalog { display: flex; flex-direction: column; min-height: 0; gap: 14px; }
.search { position: relative; }
.search .input { padding-right: 70px; background: var(--panel); backdrop-filter: blur(14px); }
.search .clear { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); }
.scan-hint { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 8px; color: var(--muted); }
.chips-row { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 6px; margin: -2px; scrollbar-width: none; }
.chips-row::-webkit-scrollbar { display: none; }
.tiles-scroll { flex: 1; min-height: 0; overflow-y: auto; margin: 0 -8px; padding: 6px 8px 24px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(132px, 11vw, 176px), 1fr)); gap: clamp(10px, 1.1vw, 16px); }
.tile {
  position: relative; overflow: hidden; isolation: isolate;
  display: flex; flex-direction: column; align-items: flex-start; gap: 9px; min-height: 160px; padding: 14px;
  border-radius: 20px; border: 1px solid var(--border); background: var(--panel);
  backdrop-filter: blur(14px); color: var(--text); font: inherit; text-align: left; cursor: pointer;
  transition: transform .4s var(--spring), border-color .3s, box-shadow .4s;
}
.tile::before {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: radial-gradient(130% 90% at 0% 0%, color-mix(in srgb, var(--cat) 24%, transparent), transparent 62%);
  opacity: .75; transition: opacity .3s;
}
.tile::after {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .09) 50%, transparent 65%);
  transform: translateX(-100%); transition: transform .9s var(--ease);
}
.tile:hover { transform: translateY(-5px); border-color: color-mix(in srgb, var(--cat) 55%, transparent); box-shadow: 0 22px 36px -20px color-mix(in srgb, var(--cat) 75%, transparent); }
.tile:hover::before { opacity: 1; }
.tile:hover::after { transform: translateX(100%); }
.tile:active { transform: scale(.95); transition-duration: .1s; }
.tile-icon {
  width: 56px; height: 56px; border-radius: 17px; display: grid; place-items: center;
  color: color-mix(in srgb, var(--cat) 80%, var(--text));
  background: color-mix(in srgb, var(--cat) 17%, transparent); border: 1px solid color-mix(in srgb, var(--cat) 28%, transparent);
  transition: transform .5s var(--spring);
}
.tile:hover .tile-icon { transform: scale(1.12) rotate(-7deg); }
.tile-name { font-weight: 700; font-size: 14px; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.tile-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 6px; }
.tile-price { font-weight: 800; font-size: 15px; letter-spacing: -.01em; }
.tile-stock { font-size: 11px; font-weight: 700; color: var(--muted); white-space: nowrap; }
.s-low .tile-stock { color: var(--warning); }
.s-maxed .tile-stock { color: var(--danger); }
.s-out { opacity: .42; cursor: not-allowed; filter: grayscale(.6); }
.s-out:hover { transform: none; box-shadow: none; border-color: var(--border); }
.s-out .tile-stock { color: var(--danger); }
.tile-qty {
  position: absolute; top: 11px; right: 11px; min-width: 28px; height: 28px; padding: 0 8px; border-radius: 99px;
  display: grid; place-items: center; font-weight: 800; font-size: 13px; color: #fff;
  background: var(--grad); box-shadow: 0 8px 16px -6px var(--c1);
}
.tile-enter-active { transition: opacity .45s var(--ease), transform .55s var(--spring); transition-delay: calc(var(--i) * 18ms); }
.tile-enter-from { opacity: 0; transform: translateY(14px) scale(.94); }
.tile-leave-active { display: none; }

/* cart */
.cart { display: flex; flex-direction: column; min-height: 0; overflow: hidden; border-radius: 24px; }
.cart-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 18px 12px; }
.cart-head h3 { font-size: 18px; font-weight: 800; }
.mini-badge { position: absolute; top: -5px; right: -5px; min-width: 17px; height: 17px; border-radius: 99px; display: grid; place-items: center; font-size: 10px; font-weight: 800; background: var(--warning); color: #241500; }
.close-cart { display: none; }
.customer {
  display: flex; align-items: center; gap: 12px; margin: 0 14px 6px; padding: 10px 12px; border-radius: 16px;
  border: 1.5px dashed var(--border-2); background: transparent; text-align: left; cursor: pointer; transition: all .3s var(--ease);
}
.customer:hover { border-color: color-mix(in srgb, var(--c1) 60%, transparent); background: var(--surface); }
.customer.has { border-style: solid; border-color: color-mix(in srgb, var(--c1) 35%, transparent); background: var(--grad-soft); }
.customer .grow { display: flex; flex-direction: column; line-height: 1.3; }
.c-ico { width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; background: var(--surface-2); color: var(--accent-ink); }
.inline { display: inline; vertical-align: -1px; }

.lines { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 10px; position: relative; }
.lines-inner { position: relative; display: flex; flex-direction: column; gap: 4px; }
.line { display: grid; grid-template-columns: minmax(0, 1fr) auto 76px; align-items: center; gap: 10px; padding: 8px; border-radius: 14px; transition: background .2s; width: 100%; }
.line:hover { background: var(--surface-2); }
.line-main { display: flex; align-items: center; gap: 10px; min-width: 0; background: none; border: 0; padding: 0; cursor: pointer; text-align: left; }
.line-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0; color: color-mix(in srgb, var(--cat) 80%, var(--text)); background: color-mix(in srgb, var(--cat) 16%, transparent); }
.line-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.line-name { font-weight: 650; font-size: 13.5px; }
.disc { color: var(--success); font-weight: 700; }
.stepper { display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 11px; background: var(--surface-2); border: 1px solid var(--border); }
.stepper button { width: 26px; height: 26px; border-radius: 8px; border: 0; background: transparent; color: var(--text-2); display: grid; place-items: center; cursor: pointer; transition: all .2s; }
.stepper button:hover { background: var(--grad); color: #fff; }
.stepper span { min-width: 22px; text-align: center; font-weight: 700; font-size: 13px; }
.line-total { text-align: right; font-weight: 750; font-size: 13.5px; }
.line-enter-active { transition: all .45s var(--spring); }
.line-leave-active { transition: all .3s var(--ease); position: absolute; }
.line-enter-from { opacity: 0; transform: translateX(30px) scale(.96); }
.line-leave-to { opacity: 0; transform: translateX(-30px); }
.line-move { transition: transform .4s var(--ease); }

.cart-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 4px; height: 100%; min-height: 200px; padding: 20px; }
.bag { width: 72px; height: 72px; border-radius: 24px; display: grid; place-items: center; margin-bottom: 10px; color: var(--accent-ink); background: var(--grad-soft); border: 1px solid var(--border); animation: floaty 4s ease-in-out infinite; }
.shortcuts { display: flex; gap: 12px; margin-top: 14px; }

.cart-foot { padding: 12px 16px 16px; border-top: 1px solid var(--border); background: var(--surface); display: flex; flex-direction: column; gap: 12px; }
.quick-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.qa {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 12px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); cursor: pointer;
  font: 650 11.5px var(--font); transition: all .25s var(--ease);
}
.qa:hover:not(:disabled) { color: var(--text); border-color: var(--border-2); transform: translateY(-2px); }
.qa.on { color: var(--accent-ink); border-color: color-mix(in srgb, var(--c1) 45%, transparent); background: color-mix(in srgb, var(--c1) 14%, transparent); }
.qa:disabled { opacity: .4; cursor: not-allowed; }
.sums { display: flex; flex-direction: column; gap: 5px; }
.sum { display: flex; justify-content: space-between; font-size: 13.5px; color: var(--text-2); }
.sum.disc { color: var(--success); }
.sum.total { margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--border-2); font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: -.02em; }
.charge { width: 100%; }
.charge kbd { background: rgba(255, 255, 255, .2); color: #fff; border-color: rgba(255, 255, 255, .3); margin-left: 4px; }
.charge:not(:disabled) { animation: chargeGlow 3s ease-in-out infinite; }
@keyframes chargeGlow { 0%, 100% { box-shadow: 0 10px 24px -10px color-mix(in srgb, var(--c1) 85%, transparent); } 50% { box-shadow: 0 16px 36px -10px color-mix(in srgb, var(--c3) 85%, transparent); } }
.cart-bar { display: none; }
.cart-scrim { display: none; }
.grab { display: none; }

/* gate */
.gate { position: absolute; inset: -6px -8px; z-index: 20; display: grid; place-items: center; padding: 20px; background: color-mix(in srgb, var(--bg) 55%, transparent); backdrop-filter: blur(10px); border-radius: 24px; }
.gate-card { width: 100%; max-width: 440px; padding: 30px; text-align: center; display: flex; flex-direction: column; gap: 14px; border-radius: 28px; animation: popIn .6s var(--spring); }
.gate-card h2 { font-size: 21px; font-weight: 800; }
.gate-ico { width: 64px; height: 64px; margin: 0 auto; border-radius: 20px; display: grid; place-items: center; color: #fff; background: var(--grad); box-shadow: 0 16px 30px -12px var(--c1); animation: floaty 4s ease-in-out infinite; }
.gate .field { text-align: left; }

/* modals */
.big-stepper { display: grid; grid-template-columns: 42px 1fr 42px; gap: 8px; }
.big-stepper .icon-btn { width: 42px; height: 42px; }
.line-preview { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-radius: 14px; background: var(--surface-2); }
.line-preview strong { font-size: 18px; }
.held-list { display: flex; flex-direction: column; gap: 8px; }
.held { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border); }
.held .grow { display: flex; flex-direction: column; line-height: 1.3; }
.held-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0; color: var(--accent-ink); background: var(--grad-soft); }
.held .grow { min-width: 0; }

.success { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; }
.success h2 { font-size: 22px; font-weight: 800; margin-top: 6px; }
.check { width: 76px; height: 76px; }
.check circle { fill: none; stroke: var(--success); stroke-width: 3; stroke-dasharray: 152; stroke-dashoffset: 152; animation: draw .7s var(--ease) forwards; }
.check path { fill: none; stroke: var(--success); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: draw .45s .55s var(--ease) forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
.change-due { margin: 8px 0 4px; padding: 12px 26px; border-radius: 18px; background: color-mix(in srgb, var(--success) 12%, transparent); border: 1px solid color-mix(in srgb, var(--success) 30%, transparent); display: flex; flex-direction: column; animation: popIn .5s .4s var(--spring) both; }
.change-due span { font-size: 11.5px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; color: var(--success); }
.change-due strong { font-size: 32px; font-weight: 800; color: var(--success); letter-spacing: -.03em; }
.receipt-wrap { margin-top: 16px; width: 100%; animation: receiptIn .9s .3s var(--ease) both; }
@keyframes receiptIn { from { opacity: 0; transform: translateY(-30px); clip-path: inset(0 0 100% 0); } to { opacity: 1; transform: none; clip-path: inset(0 0 -20px 0); } }

/* short screens (landscape tablets / laptops): keep the cart lines visible */
@media (max-height: 700px) and (min-width: 981px) {
  .cart-head { padding: 12px 16px 8px; }
  .qa { flex-direction: row; justify-content: center; padding: 7px 4px; }
  .qa span { display: none; }
  .cart-foot { gap: 8px; padding: 10px 14px 12px; }
  .sum.total { font-size: 19px; }
  .charge { --h: 50px; }
  .tile { min-height: 132px; }
  .tile-icon { width: 46px; height: 46px; border-radius: 14px; }
}

/* compact screens: cart becomes a drawer, checkout bar at the bottom */
@media (max-width: 980px) {
  .register { grid-template-columns: minmax(0, 1fr); }
  .cart {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 70; width: min(440px, 100%);
    padding-top: var(--safe-t); padding-bottom: var(--safe-b);
    border-radius: 24px 0 0 24px; transform: translateX(105%); visibility: hidden;
    transition: transform .5s var(--ease), visibility 0s linear .5s; background: var(--bg-2);
  }
  .cart.open { transform: none; visibility: visible; transition: transform .5s var(--ease), visibility 0s; }
  .close-cart { display: inline-grid; }
  .cart-scrim { display: block; position: fixed; inset: 0; z-index: 69; background: rgba(0, 0, 0, .5); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
  .tiles-scroll { padding-bottom: 96px; }

  .cart-bar {
    position: fixed; z-index: 45; display: flex; align-items: center; gap: 10px;
    left: calc(var(--rail-w) + var(--gutter) + var(--safe-l)); right: calc(var(--gutter) + var(--safe-r));
    bottom: calc(var(--tabbar-space) + 12px);
    margin: 0 auto; max-width: 640px; padding: 8px 8px 8px 10px; border-radius: 22px;
    background: color-mix(in srgb, var(--bg-2) 88%, transparent); border: 1px solid var(--border-2);
    box-shadow: 0 18px 40px -16px rgba(0, 0, 0, .55), 0 0 0 1px color-mix(in srgb, var(--c1) 12%, transparent);
    backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%);
  }
  .cb-cart { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 4px; border: 0; background: none; cursor: pointer; text-align: left; border-radius: 16px; }
  .cb-ico {
    position: relative; flex-shrink: 0; width: 46px; height: 46px; border-radius: 15px; display: grid; place-items: center;
    color: var(--accent-ink); background: var(--grad-soft); border: 1px solid var(--border);
  }
  .cb-count {
    position: absolute; top: -6px; right: -6px; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 99px;
    display: grid; place-items: center; font-size: 11.5px; font-weight: 800; color: #fff; background: var(--grad);
    box-shadow: 0 0 0 2px var(--bg-2);
  }
  .cb-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
  .cb-total { font-size: 19px; font-weight: 800; letter-spacing: -.02em; }
  .cb-text small { color: var(--muted); font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cb-pay { --h: 52px; padding: 0 22px; border-radius: 16px; font-size: 15px; flex-shrink: 0; }
  .cart-bar.empty .cb-total { color: var(--muted); }
  .bar-enter-active, .bar-leave-active { transition: transform .45s var(--spring), opacity .25s; }
  .bar-enter-from, .bar-leave-to { transform: translateY(30px); opacity: 0; }
}

/* phones: full-width sheet that slides up, swipe down to close */
@media (max-width: 860px) {
  .catalog { gap: 10px; }
  .search .input { height: 46px; border-radius: 14px; }
  .chips-row { margin: -2px calc(-1 * var(--gutter)); padding: 2px var(--gutter) 4px; }
  .chips-row .chip { height: 36px; }
  .tiles-scroll { margin: 0 calc(-1 * var(--gutter)); padding: 4px var(--gutter) 100px; }

  .cart-bar { left: calc(10px + var(--safe-l)); right: calc(10px + var(--safe-r)); bottom: calc(var(--tabbar-space) + 10px); }

  .cart {
    top: auto; left: 0; width: 100%; height: calc(100dvh - 40px - var(--safe-t)); max-height: 820px;
    padding-top: 0; border-radius: 26px 26px 0 0; border-bottom: 0;
    transform: translateY(105%); box-shadow: 0 -24px 60px -20px rgba(0, 0, 0, .55);
  }
  .cart.open { transform: none; }
  .grab { display: grid; place-items: center; height: 22px; flex-shrink: 0; touch-action: none; cursor: grab; }
  .handle { width: 44px; height: 5px; border-radius: 99px; background: var(--border-2); }
  .grab-title { touch-action: none; }
  .cart-head { padding: 4px 16px 10px; }
  .customer { margin: 0 12px 6px; }
  .lines { padding: 4px 8px; }
  .cart-foot { padding: 12px 14px calc(14px + var(--safe-b)); }
}
@media (max-width: 600px) {
  .tiles { grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
  .tile { min-height: 124px; padding: 11px; gap: 7px; border-radius: 18px; }
  .tile-icon { width: 42px; height: 42px; border-radius: 13px; }
  .tile-icon :deep(svg) { width: 21px; height: 21px; }
  .tile-name { font-size: 13px; }
  .tile-price { font-size: 14px; }
  .tile-stock { font-size: 10.5px; }
  .tile-qty { top: 8px; right: 8px; min-width: 24px; height: 24px; font-size: 12px; }
  .tile-foot { flex-direction: column; align-items: flex-start; gap: 0; }
}

/* touch: bigger steppers, no hover lifts */
@media (pointer: coarse) {
  .stepper button { width: 34px; height: 34px; border-radius: 9px; }
  .stepper span { min-width: 26px; font-size: 14px; }
  .qa { padding: 10px 4px; }
}
@media (hover: none) {
  .tile:hover { transform: none; box-shadow: none; border-color: var(--border); }
  .tile:hover .tile-icon { transform: none; }
  .tile:hover::after { transform: translateX(-100%); }
  .tile:active { transform: scale(.95); border-color: color-mix(in srgb, var(--cat) 55%, transparent); }
  .stepper button:hover { background: transparent; color: var(--text-2); }
  .stepper button:active { background: var(--grad); color: #fff; }
}
</style>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import {
  Zap, WifiOff, ChartColumn, Package, Users, ScanBarcode, ShieldCheck, Smartphone, ArrowRight, Check,
  Sparkles, Store, Menu, X, Clock, ChevronDown, Coffee, ShoppingBag, Scissors, Sun, Moon, Gift,
  Lock, TrendingUp, CreditCard, Layers, MonitorDown, Download, Monitor, KeyRound,
} from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { installed, detectDevice } from '@/composables/pwa'
import { installNow } from '@/composables'
import { CURRENCIES, ROLES, PAYMENT_METHODS } from '@/utils/constants'
import BrandMark from '@/components/BrandMark.vue'
import Wordmark from '@/components/Wordmark.vue'

const pos = usePos()
const router = useRouter()
const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Scroll reveal + count-up (one shared observer) */
const onSeen = new WeakMap()
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      e.target.classList.add('in')
      onSeen.get(e.target)?.()
      io.unobserve(e.target)
    }
  },
  { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
)

const vReveal = {
  mounted(el, { value }) {
    el.classList.add('reveal')
    if (value) el.style.setProperty('--d', `${value}ms`)
    io.observe(el)
  },
  unmounted: (el) => io.unobserve(el),
}

const vCount = {
  mounted(el, { value }) {
    const { to, dec = 0, pre = '', suf = '' } = value
    const fmt = (n) => pre + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf
    el.textContent = fmt(reduce ? to : 0)
    if (reduce) return
    onSeen.set(el, () => {
      const t0 = performance.now()
      const dur = 1700
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur)
        el.textContent = fmt(to * (1 - Math.pow(1 - p, 4)))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    io.observe(el)
  },
  unmounted: (el) => io.unobserve(el),
}

/* Nav */
const sentinel = ref(null)
const scrolled = ref(false)
const menuOpen = ref(false)
let navIo
const links = [
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'faq', label: 'FAQ' },
]
function go(id) {
  menuOpen.value = false
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}
// new visitors create a business; a device that already belongs to one goes to the login screen
const start = () => router.push(pos.signedIn ? { name: 'login' } : { name: 'signup' })
const signIn = () => router.push({ name: 'login' })
const ctaLabel = computed(() => (pos.signedIn ? `Open ${pos.business?.name || 'the register'}` : 'Create your business'))
const onDesktop = detectDevice().desktop
async function install() {
  menuOpen.value = false
  await installNow()
}
const isDark = computed(() => pos.settings.theme !== 'light')
const toggleTheme = () => (pos.settings.theme = isDark.value ? 'light' : 'dark')

/* Hero: tilt */
const tilt = ref({ x: 0, y: 0 })
function onHeroMove(e) {
  if (reduce || e.pointerType === 'touch') return
  const r = e.currentTarget.getBoundingClientRect()
  tilt.value = { x: ((e.clientY - r.top) / r.height - 0.5) * -7, y: ((e.clientX - r.left) / r.width - 0.5) * 9 }
}
const resetTilt = () => (tilt.value = { x: 0, y: 0 })

const headline = [
  { t: 'The' }, { t: 'point' }, { t: 'of' }, { t: 'sale' }, { t: 'that' },
  { t: 'moves', g: true }, { t: 'at', g: true }, { t: 'your', g: true }, { t: 'speed.', g: true },
]

/* Hero: live register demo */
const demoProducts = [
  { name: 'Flat white', price: 4.5, icon: Coffee, hue: 265 },
  { name: 'Croissant', price: 3.75, icon: Gift, hue: 30 },
  { name: 'Tote bag', price: 18, icon: ShoppingBag, hue: 190 },
  { name: 'Cold brew', price: 5.25, icon: Coffee, hue: 215 },
  { name: 'Gift card', price: 25, icon: CreditCard, hue: 330 },
  { name: 'Trim', price: 22, icon: Scissors, hue: 150 },
]
const cart = ref([])
const pressed = ref(-1)
const status = ref('idle') // idle | charging | approved
const subtotal = computed(() => cart.value.reduce((s, l) => s + l.price * l.qty, 0))
const total = computed(() => subtotal.value * 1.08)
const shownTotal = ref(0)
let alive = true
let raf = 0

watch(total, (to) => {
  cancelAnimationFrame(raf)
  if (reduce) return (shownTotal.value = to)
  const from = shownTotal.value
  const t0 = performance.now()
  const step = (t) => {
    const p = Math.min(1, (t - t0) / 450)
    shownTotal.value = from + (to - from) * (1 - Math.pow(1 - p, 3))
    if (p < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
function addToCart(i) {
  const p = demoProducts[i]
  const line = cart.value.find((l) => l.name === p.name)
  if (line) line.qty++
  else cart.value.push({ ...p, qty: 1 })
  pressed.value = i
  setTimeout(() => pressed.value === i && (pressed.value = -1), 380)
}
async function runDemo() {
  const seq = [0, 1, 0, 2, 3]
  while (alive) {
    cart.value = []
    status.value = 'idle'
    await wait(900)
    for (const i of seq) {
      if (!alive) return
      addToCart(i)
      await wait(850)
    }
    await wait(500)
    status.value = 'charging'
    await wait(1300)
    status.value = 'approved'
    await wait(2300)
  }
}

/* Features */
function spot(e) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}
const stock = [
  { name: 'Oat milk', v: 18, low: true },
  { name: 'Espresso beans', v: 64 },
  { name: 'Croissants', v: 82 },
]
const spark = 'M0 62 C 30 58, 45 40, 70 44 S 115 22, 140 30 S 190 8, 215 14 S 260 4, 300 6'

/* Dashboard showcase */
const week = [
  { d: 'Mon', v: 52 }, { d: 'Tue', v: 64 }, { d: 'Wed', v: 58 }, { d: 'Thu', v: 77 },
  { d: 'Fri', v: 92 }, { d: 'Sat', v: 100 }, { d: 'Sun', v: 71 },
]

/* Facts (all read from the app itself) */
const facts = [
  { to: PAYMENT_METHODS.length, label: 'ways to take payment: cash, card & mobile, or split' },
  { to: Object.keys(ROLES).length, label: 'staff roles with their own permissions' },
  { to: CURRENCIES.length, label: 'currencies supported out of the box' },
  { to: 4, label: 'digit PIN sign-in for every team member' },
]

const faqs = [
  { q: 'Do I need special hardware?', a: 'No. Maynex POS runs in a modern browser on a laptop, tablet or phone. A USB or Bluetooth barcode scanner that types into the search box works for scanning, and receipts print at 80 mm through your browser’s print dialog.' },
  { q: 'How do I get started?', a: 'Create your business with its name, type, location, phone and currency, then your owner email, password and till PIN. Sign each shop device in once with that email; after that your staff sign in on it with their username and PIN.' },
  { q: 'What happens if the internet goes down?', a: 'Nothing stops. Each device keeps a full working copy of your business, so you can keep ringing up sales with no connection. Everything syncs to your account when the connection returns.' },
  { q: 'Does Maynex POS process card payments?', a: 'Maynex POS records how each sale was paid (cash, card, mobile or a split) and calculates change. It doesn’t connect to card terminals, so charge the card on your terminal as usual and then complete the sale in Maynex POS.' },
  { q: 'Where is my data stored, and is it private?', a: 'In your business account on the Maynex POS server, with a working copy on each of your signed-in devices. Every business is kept separate from every other one. You can also download a full backup from Settings → Data & backup at any time.' },
  { q: 'Which staff roles are there?', a: 'Six. Managers run everything. Supervisors sell, refund and run cash shifts. Cashiers sell and see only their own sales. Procurement manages products and stock. Accountants see sales, reports and cash reconciliation. Customer service looks after customers and their orders. Each role sees only its own screens.' },
  { q: 'How do I put Maynex POS on my device?', a: 'Press “Install” on this page or in Settings. Maynex POS then opens in its own window from your desktop, taskbar, dock or home screen.' },
  { q: 'Do my staff have to install it?', a: 'No. Staff can sign in from any browser, or from the installed app, with your shop code, their username and their PIN. The shop code is on your Team page. Sales, stock and shifts sync between every device.' },
]
const openFaq = ref(0)

const verticals = [
  { icon: Coffee, label: 'Cafés' }, { icon: ShoppingBag, label: 'Boutiques' }, { icon: Gift, label: 'Gift shops' },
  { icon: Scissors, label: 'Salons' }, { icon: Store, label: 'Corner stores' }, { icon: Layers, label: 'Bakeries' },
  { icon: Smartphone, label: 'Pop-ups' }, { icon: Package, label: 'Market stalls' },
]

/* Phone: sticky call-to-action once the hero is scrolled past, hidden again at the closing CTA */
const heroEl = ref(null)
const ctaEl = ref(null)
const heroGone = ref(false)
const ctaInView = ref(false)
const showBar = computed(() => heroGone.value && !ctaInView.value && !menuOpen.value)
let barIo

/* Phone: feature cards swipe sideways, with dots showing where you are */
const bentoEl = ref(null)
const featIndex = ref(0)
const FEAT_COUNT = 7
function onBentoScroll() {
  const el = bentoEl.value
  if (!el) return
  const card = el.firstElementChild
  const step = card ? card.getBoundingClientRect().width + 12 : el.clientWidth
  featIndex.value = Math.min(FEAT_COUNT - 1, Math.round(el.scrollLeft / step))
}
function goFeat(i) {
  const card = bentoEl.value?.children[i]
  if (card) bentoEl.value.scrollTo({ left: card.offsetLeft - bentoEl.value.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' })
}

// close the phone menu with Escape
function onKey(e) {
  if (e.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  navIo = new IntersectionObserver(([e]) => (scrolled.value = !e.isIntersecting))
  if (sentinel.value) navIo.observe(sentinel.value)
  barIo = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.target === heroEl.value) heroGone.value = !e.isIntersecting
      else ctaInView.value = e.isIntersecting
    }
  }, { rootMargin: '-35% 0px 0px 0px' })
  if (heroEl.value) barIo.observe(heroEl.value)
  if (ctaEl.value) barIo.observe(ctaEl.value)
  if (reduce) {
    ;[0, 1, 0, 2].forEach(addToCart)
    pressed.value = -1
    status.value = 'approved'
  } else runDemo()
})
onBeforeUnmount(() => {
  alive = false
  cancelAnimationFrame(raf)
  io.disconnect()
  navIo?.disconnect()
  barIo?.disconnect()
  window.removeEventListener('keydown', onKey)
})

const money = (n) => `$${n.toFixed(2)}`
const year = new Date().getFullYear()
</script>

<template>
  <div class="landing">
    <span ref="sentinel" class="sentinel" aria-hidden="true"></span>

    <header class="nav" :class="{ scrolled, open: menuOpen }">
      <div class="wrap nav-row">
        <a class="logo" href="#" @click.prevent="go('top')">
          <BrandMark :size="34" />
          <Wordmark :size="19" />
        </a>
        <nav class="nav-links" aria-label="Sections">
          <button v-for="l in links" :key="l.id" @click="go(l.id)">{{ l.label }}</button>
        </nav>
        <div class="nav-cta">
          <button class="icon-btn sm" :title="isDark ? 'Light mode' : 'Dark mode'" @click="toggleTheme">
            <Transition name="swap" mode="out-in">
              <Sun v-if="isDark" key="s" :size="16" />
              <Moon v-else key="m" :size="16" />
            </Transition>
          </button>
          <button v-if="!installed" class="btn btn-ghost btn-sm hide-sm" @click="install"><MonitorDown :size="15" /> Install</button>
          <button class="btn btn-ghost btn-sm hide-sm" @click="signIn">Sign in</button>
          <button class="btn btn-primary btn-sm" @click="start">{{ pos.signedIn ? 'Open app' : 'Get started' }}</button>
          <button class="icon-btn sm burger" :aria-expanded="menuOpen" aria-label="Menu" @click="menuOpen = !menuOpen">
            <X v-if="menuOpen" :size="17" /><Menu v-else :size="17" />
          </button>
        </div>
      </div>
      <Transition name="drop">
        <div v-if="menuOpen" class="mobile-menu">
          <button v-for="l in links" :key="l.id" class="mm-link" @click="go(l.id)">{{ l.label }}<ArrowRight :size="16" /></button>
          <button v-if="!installed" class="mm-link" @click="install">Install the app<ArrowRight :size="16" /></button>
          <div class="mm-actions">
            <button class="btn btn-primary btn-lg btn-block" @click="start">{{ ctaLabel }} <ArrowRight :size="16" /></button>
            <button class="btn btn-lg btn-block" @click="signIn">Sign in</button>
          </div>
        </div>
      </Transition>
    </header>
    <Transition name="fade"><div v-if="menuOpen" class="menu-scrim" @click="menuOpen = false"></div></Transition>

    <Transition name="bar">
      <div v-if="showBar" class="mobile-cta">
        <button class="btn btn-primary btn-lg" @click="start">{{ ctaLabel }} <ArrowRight :size="17" /></button>
        <button class="btn btn-lg" @click="signIn">Sign in</button>
      </div>
    </Transition>

    <section id="top" ref="heroEl" class="hero" @pointermove="onHeroMove" @pointerleave="resetTilt">
      <div class="wrap hero-grid">
        <div class="hero-copy">
          <span class="pill rise" style="--i: 0">
            <span class="pill-new">App</span> Install it on any device and sell offline <ArrowRight :size="14" />
          </span>
          <h1 class="hero-title">
            <span v-for="(w, i) in headline" :key="i" class="word" :style="{ '--i': i }">
              <span :class="{ 'gradient-text grad-anim': w.g }">{{ w.t }}</span>
            </span>
          </h1>
          <p class="hero-sub rise" style="--i: 9">
            <b>Maynex POS</b> is a point of sale for shops: your till, stock, customers and sales reports in one
            simple app that runs in any browser. It even keeps selling when the Wi-Fi doesn't.
          </p>
          <div class="hero-actions rise" style="--i: 10">
            <button class="btn btn-primary btn-lg" @click="start">{{ ctaLabel }} <ArrowRight :size="17" /></button>
            <button v-if="!installed" class="btn btn-lg" @click="install"><Download :size="17" /> {{ onDesktop ? 'Install on desktop' : 'Install app' }}</button>
            <button v-else class="btn btn-lg" @click="go('features')">See how it works</button>
          </div>
          <ul class="hero-proof rise" style="--i: 11">
            <li><Check :size="15" /> Sign up in two minutes</li>
            <li><Check :size="15" /> Works without internet</li>
            <li><Check :size="15" /> Runs in any modern browser</li>
          </ul>
        </div>

        <div class="hero-stage rise" style="--i: 4">
          <div class="stage-glow" aria-hidden="true"></div>
          <div class="mock" :style="{ transform: `perspective(1400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }">
            <div class="mock-bar">
              <i></i><i></i><i></i>
              <span>Register · Counter 1</span>
              <span class="live"><span class="dot"></span>Live</span>
            </div>
            <div class="mock-body">
              <div class="tiles">
                <div v-for="(p, i) in demoProducts" :key="p.name" class="tile" :class="{ pressed: pressed === i }" :style="{ '--h': p.hue }">
                  <span class="tile-ic"><component :is="p.icon" :size="17" /></span>
                  <b>{{ p.name }}</b>
                  <small>{{ money(p.price) }}</small>
                </div>
              </div>
              <div class="ticket">
                <div class="ticket-head">Current sale <span>#1042</span></div>
                <TransitionGroup tag="ul" name="line" class="lines">
                  <li v-for="l in cart" :key="l.name">
                    <span class="qty">{{ l.qty }}×</span>
                    <span class="nm">{{ l.name }}</span>
                    <span class="pr">{{ money(l.price * l.qty) }}</span>
                  </li>
                </TransitionGroup>
                <div v-if="!cart.length" class="empty">Tap a product to start</div>
                <div class="sums">
                  <div><span>Subtotal</span><span>{{ money(subtotal) }}</span></div>
                  <div><span>Tax 8%</span><span>{{ money(subtotal * 0.08) }}</span></div>
                  <div class="tot"><span>Total</span><span>{{ money(shownTotal) }}</span></div>
                </div>
                <div class="charge" :class="status">
                  <Transition name="swap" mode="out-in">
                    <span v-if="status === 'idle'" key="i">Charge {{ money(total) }}</span>
                    <span v-else-if="status === 'charging'" key="c"><span class="spinner"></span>Processing…</span>
                    <span v-else key="a"><Check :size="17" /> Approved</span>
                  </Transition>
                </div>
              </div>
            </div>
          </div>

          <div class="float f1"><span class="fi ok"><Check :size="15" /></span><div><b>Drawer balanced</b><small>shift closed</small></div></div>
          <div class="float f2"><span class="fi warn"><Package :size="15" /></span><div><b>Low stock alert</b><small>restock before you run out</small></div></div>
          <div class="float f3"><span class="fi info"><WifiOff :size="15" /></span><div><b>Offline? Still selling</b><small>syncs when back online</small></div></div>
        </div>
      </div>

      <button class="scroll-cue" aria-label="Scroll to features" @click="go('features')"><ChevronDown :size="18" /></button>
    </section>

    <section class="band" aria-label="Who uses Maynex POS">
      <p class="band-label">Built for the counters that keep a neighbourhood running</p>
      <div class="marquee">
        <div class="track">
          <span v-for="(v, i) in [...verticals, ...verticals]" :key="i" class="mq" :aria-hidden="i >= verticals.length">
            <component :is="v.icon" :size="18" /> {{ v.label }}
          </span>
        </div>
      </div>
    </section>

    <section class="wrap stats">
      <div v-for="(f, i) in facts" :key="f.label" v-reveal="i * 80" class="stat"><b v-count="{ to: f.to }"></b><span>{{ f.label }}</span></div>
    </section>

    <section id="features" class="wrap section">
      <div v-reveal class="sec-head">
        <span class="eyebrow"><Sparkles :size="14" /> Everything in one place</span>
        <h2>One app for the whole shop, <span class="gradient-text">front to back.</span></h2>
        <p>Stop juggling a till, a stock spreadsheet and a loyalty punch card. Maynex POS does all of it, and it's a joy to use.</p>
      </div>

      <div ref="bentoEl" class="bento" @scroll.passive="onBentoScroll">
        <article v-reveal="0" class="feat span-2" @pointermove="spot">
          <div class="feat-ic"><Zap :size="20" /></div>
          <h3>A register built for the rush</h3>
          <p>Big tap targets, instant search, barcode scanning and keyboard shortcuts. Split payments, discounts and parked sales take a tap.</p>
          <div class="v-keys">
            <span class="k">/ <small>Search</small></span>
            <span class="k"><ScanBarcode :size="14" /> <small>Scan</small></span>
            <span class="k">F2 <small>Charge</small></span>
            <span class="k">F4 <small>Park sale</small></span>
          </div>
        </article>

        <article v-reveal="80" class="feat" @pointermove="spot">
          <div class="feat-ic"><WifiOff :size="20" /></div>
          <h3>Never miss a sale</h3>
          <p>Internet down? Keep selling. Every sale is saved on the device and syncs to your account when the connection returns.</p>
          <div class="v-sync"><span class="sync-a">Offline</span><span class="sync-b"><Check :size="13" /> Still selling</span></div>
        </article>

        <article v-reveal="0" class="feat" @pointermove="spot">
          <div class="feat-ic"><Package :size="20" /></div>
          <h3>Inventory that keeps count</h3>
          <p>Stock updates with every sale, and you get a heads-up before you run out.</p>
          <div class="v-stock">
            <div v-for="s in stock" :key="s.name" class="srow" :class="{ low: s.low }">
              <span>{{ s.name }}</span><i><em :style="{ '--w': s.v + '%' }"></em></i>
            </div>
          </div>
        </article>

        <article v-reveal="80" class="feat span-2" @pointermove="spot">
          <div class="feat-ic"><ChartColumn :size="20" /></div>
          <h3>Reports you'll actually read</h3>
          <p>Best sellers, busiest hours, margins and staff performance, updated with every sale and exportable to CSV.</p>
          <svg class="v-spark" viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="lg-spark" x1="0" x2="1"><stop offset="0" stop-color="var(--c1)" /><stop offset="1" stop-color="var(--c3)" /></linearGradient>
              <linearGradient id="lg-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c2)" stop-opacity=".28" /><stop offset="1" stop-color="var(--c2)" stop-opacity="0" /></linearGradient>
            </defs>
            <path class="fill" :d="spark + ' L300 70 L0 70 Z'" fill="url(#lg-fill)" />
            <path class="line" :d="spark" fill="none" stroke="url(#lg-spark)" stroke-width="3" stroke-linecap="round" pathLength="1" />
          </svg>
        </article>

        <article v-reveal="0" class="feat" @pointermove="spot">
          <div class="feat-ic"><Users :size="20" /></div>
          <h3>Customers who come back</h3>
          <p>Profiles, purchase history and loyalty points that reward regulars automatically.</p>
          <div class="v-avatars">
            <span v-for="h in [265, 190, 330, 30]" :key="h" :style="{ '--h': h }"></span>
            <b>+240 pts</b>
          </div>
        </article>

        <article v-reveal="80" class="feat" @pointermove="spot">
          <div class="feat-ic"><Clock :size="20" /></div>
          <h3>Team & shifts</h3>
          <p>Six roles from manager to cashier, each with its own login and screens, plus counted cash drawers at every close.</p>
          <div class="v-pin"><i></i><i></i><i></i><i></i></div>
        </article>

        <article v-reveal="160" class="feat" @pointermove="spot">
          <div class="feat-ic"><ShieldCheck :size="20" /></div>
          <h3>Refunds under control</h3>
          <p>Only managers and admins can refund, and every refund records who, when and why.</p>
          <div class="v-lock"><Lock :size="15" /> Manager approval</div>
        </article>
      </div>
      <div class="feat-dots" role="tablist" aria-label="Features">
        <button v-for="i in FEAT_COUNT" :key="i" :class="{ on: featIndex === i - 1 }" :aria-label="`Feature ${i}`" @click="goFeat(i - 1)"></button>
      </div>
    </section>

    <section id="how" class="wrap section">
      <div v-reveal class="sec-head">
        <span class="eyebrow"><Clock :size="14" /> Up and running before lunch</span>
        <h2>Three steps to <span class="gradient-text">your first sale.</span></h2>
      </div>
      <div v-reveal class="steps">
        <div class="steps-line" aria-hidden="true"><span></span></div>
        <div class="step" style="--i: 0">
          <span class="step-n">1</span>
          <div class="step-text">
            <h3>Create your shop</h3>
            <p>Add your store name, currency and tax, and pick your admin PIN.</p>
          </div>
        </div>
        <div class="step" style="--i: 1">
          <span class="step-n">2</span>
          <div class="step-text">
            <h3>Add your products</h3>
            <p>Add each item with its price, cost, barcode, category and opening stock.</p>
          </div>
        </div>
        <div class="step" style="--i: 2">
          <span class="step-n">3</span>
          <div class="step-text">
            <h3>Start selling</h3>
            <p>Open a shift, ring up sales and record cash, card, mobile or split payments.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="wrap section showcase">
      <div v-reveal class="show-copy">
        <span class="eyebrow"><TrendingUp :size="14" /> Live insights</span>
        <h2>Your whole business, <span class="gradient-text">at a glance.</span></h2>
        <p>See the day as it happens: revenue, orders, profit, top products and stock alerts, all built from your own sales.</p>
        <ul class="ticks">
          <li><Check :size="16" /> Today vs. yesterday, and any period vs. the one before</li>
          <li><Check :size="16" /> Busiest hours and days of the week</li>
          <li><Check :size="16" /> One-click CSV exports for your accountant</li>
        </ul>
      </div>
      <div v-reveal="120" class="dash card">
        <span class="dash-tag">Illustration</span>
        <div class="dash-kpis">
          <div><small>Revenue today</small><b v-count="{ to: 3842.5, dec: 2, pre: '$' }"></b><em class="up">▲ 12.6%</em></div>
          <div><small>Orders</small><b v-count="{ to: 214 }"></b><em class="up">▲ 8.1%</em></div>
          <div><small>Avg. ticket</small><b v-count="{ to: 17.96, dec: 2, pre: '$' }"></b><em class="up">▲ 4.3%</em></div>
        </div>
        <div class="bars">
          <div v-for="(d, i) in week" :key="d.d" class="bar" :style="{ '--v': d.v, '--i': i }">
            <span class="b"><em>{{ Math.round(d.v * 6.4) }}</em></span><small>{{ d.d }}</small>
          </div>
        </div>
      </div>
    </section>

    <section id="install" class="wrap section">
      <div v-reveal class="install card">
        <div class="install-copy">
          <span class="eyebrow"><MonitorDown :size="14" /> Desktop app or any browser</span>
          <h2>On every counter, <span class="gradient-text">in one click.</span></h2>
          <p>Install Maynex POS on your computers, tablets and phones, or just open it in a browser. Your team signs in anywhere with the shop code, their username and PIN.</p>
          <div class="hero-actions">
            <button v-if="installed" class="btn btn-lg" disabled><Check :size="17" /> Installed on this device</button>
            <button v-else class="btn btn-primary btn-lg" @click="install"><Download :size="17" /> {{ onDesktop ? 'Install on this computer' : 'Install on this device' }}</button>
            <button class="btn btn-lg" @click="signIn">Team sign in</button>
          </div>
        </div>
        <ul class="install-points">
          <li><Monitor :size="18" /> Its own window on Windows, Mac and Chromebook</li>
          <li><Users :size="18" /> Staff sign in from any browser, no install needed</li>
          <li><KeyRound :size="18" /> Everyone has their own username and PIN</li>
          <li><WifiOff :size="18" /> Keeps selling offline and syncs when back</li>
        </ul>
      </div>
    </section>

    <section id="faq" class="wrap section faq-wrap">
      <div v-reveal class="sec-head">
        <span class="eyebrow">FAQ</span>
        <h2>Questions, <span class="gradient-text">answered.</span></h2>
      </div>
      <div class="faq">
        <div v-for="(f, i) in faqs" :key="f.q" v-reveal="i * 60" class="qa" :class="{ open: openFaq === i }">
          <button :aria-expanded="openFaq === i" @click="openFaq = openFaq === i ? -1 : i">
            {{ f.q }}<span class="pm"></span>
          </button>
          <div class="ans"><div><p>{{ f.a }}</p></div></div>
        </div>
      </div>
    </section>

    <section class="wrap section">
      <div ref="ctaEl" v-reveal class="cta">
        <div class="cta-orb" aria-hidden="true"></div>
        <BrandMark :size="56" />
        <h2>Ready to make checkout the easy part?</h2>
        <p>Create your business in two short steps, add your team, and start selling today.</p>
        <div class="hero-actions center">
          <button class="btn btn-primary btn-xl" @click="start">{{ ctaLabel }} <ArrowRight :size="18" /></button>
          <button class="btn btn-lg" @click="go('faq')">Read the FAQ</button>
        </div>
      </div>
    </section>

    <footer class="wrap foot">
      <div class="foot-brand">
        <a class="logo" href="#" @click.prevent="go('top')"><BrandMark :size="30" /><Wordmark :size="18" /></a>
        <p>The point of sale for independent shops.</p>
        <p class="say">Say it <b>MAY-nex</b>. The tick in the logo is a sale done right.</p>
      </div>
      <div class="foot-cols">
        <div><b>Product</b><button @click="go('features')">Features</button><button @click="go('how')">How it works</button><button @click="go('faq')">FAQ</button></div>
        <div><b>Get started</b><button @click="start">Create your business</button><button @click="signIn">Sign in</button><button @click="go('install')">Install app</button></div>
      </div>
      <div class="foot-bottom"><span>© {{ year }} Maynex POS. All rights reserved.</span><span>Made for shopkeepers.</span></div>
    </footer>
  </div>
</template>

<style scoped>
.landing { position: relative; min-height: 100%; overflow-x: clip; font-size: 15px; }
.sentinel { position: absolute; top: 0; height: 24px; width: 1px; }
.wrap { width: min(1180px, 100% - 40px); margin-inline: auto; }
.section { padding-block: clamp(64px, 10vw, 120px) 0; scroll-margin-top: 70px; }
#top { scroll-margin-top: 0; }

/* Reveal */
.reveal { opacity: 0; }
.reveal.in { opacity: 1; animation: revealIn .9s var(--ease) backwards; animation-delay: var(--d, 0ms); }
@keyframes revealIn { from { opacity: 0; transform: translateY(28px) scale(.985); filter: blur(6px); } }

/* Nav */
.nav { position: sticky; top: 0; z-index: 50; transition: background .35s ease, border-color .35s ease, backdrop-filter .35s ease; border-bottom: 1px solid transparent; }
.nav.scrolled, .nav.open { background: color-mix(in srgb, var(--bg) 72%, transparent); backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4); border-color: var(--border); }
.nav-row { display: flex; align-items: center; gap: 20px; height: 70px; }
.logo { display: inline-flex; align-items: center; gap: 10px; }
.nav-links { display: flex; gap: 4px; margin-inline: auto; }
.nav-links button { background: none; border: 0; padding: 8px 14px; border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--text-2); cursor: pointer; transition: color .2s, background .2s; }
.nav-links button:hover { color: var(--text); background: var(--surface-2); }
.nav-cta { display: flex; align-items: center; gap: 8px; }
.burger { display: none; }
.mobile-menu { display: grid; gap: 4px; padding: 8px 20px 18px; }
.mobile-menu > button:not(.btn) { display: flex; justify-content: space-between; align-items: center; background: none; border: 0; border-bottom: 1px solid var(--border); padding: 14px 4px; font-size: 16px; font-weight: 650; cursor: pointer; }
.mobile-menu .btn { margin-top: 10px; }
.drop-enter-active, .drop-leave-active { transition: opacity .25s ease, transform .3s var(--ease); }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-8px); }

/* Hero */
.hero { position: relative; padding: clamp(40px, 7vw, 90px) 0 70px; }
.hero-grid { display: grid; grid-template-columns: 1.02fr 1fr; gap: clamp(32px, 5vw, 64px); align-items: center; }
.pill { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px 5px 5px; border-radius: 99px; background: var(--surface-2); border: 1px solid var(--border-2); font-size: 13px; font-weight: 600; color: var(--text-2); }
.pill-new { padding: 3px 9px; border-radius: 99px; background: var(--grad); color: #fff; font-size: 11.5px; font-weight: 750; }
.hero-title { margin: 22px 0 20px; font-size: clamp(40px, 6.2vw, 72px); line-height: 1.02; font-weight: 800; letter-spacing: -.045em; }
.word { display: inline-block; margin-right: .22em; overflow: hidden; padding-bottom: .08em; vertical-align: top; }
.word > span { display: inline-block; animation: wordUp .9s var(--ease) both; animation-delay: calc(120ms + var(--i) * 70ms); }
.grad-anim { background-size: 200% 200%; animation: wordUp .9s var(--ease) both, gradientShift 6s ease infinite !important; animation-delay: calc(120ms + var(--i) * 70ms), 0s !important; }
@keyframes wordUp { from { transform: translateY(105%) rotate(4deg); opacity: 0; } to { transform: none; opacity: 1; } }
.hero-sub { font-size: clamp(16px, 1.6vw, 18.5px); line-height: 1.6; color: var(--text-2); max-width: 540px; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
.hero-actions.center { justify-content: center; }
.hero-proof { display: flex; flex-wrap: wrap; gap: 8px 20px; list-style: none; padding: 0; margin: 26px 0 0; font-size: 13.5px; color: var(--muted); }
.hero-proof li { display: inline-flex; align-items: center; gap: 6px; }
.hero-proof svg { color: var(--success); }

.hero-stage { position: relative; }
.stage-glow { position: absolute; inset: 8% 4%; background: var(--grad); filter: blur(70px); opacity: .35; border-radius: 40%; animation: breathe 7s ease-in-out infinite; }
@keyframes breathe { 50% { transform: scale(1.08); opacity: .5; } }
.mock { position: relative; border-radius: var(--r-xl); background: var(--panel); border: 1px solid var(--border-2); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); box-shadow: 0 40px 80px -30px rgba(0, 0, 0, .55), inset 0 1px 0 rgba(255, 255, 255, .08); transition: transform .5s var(--ease); transform-style: preserve-3d; overflow: hidden; }
.mock-bar { display: flex; align-items: center; gap: 7px; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 12px; color: var(--muted); font-weight: 600; }
.mock-bar i { width: 10px; height: 10px; border-radius: 50%; background: var(--surface-3); }
.mock-bar i:first-child { background: #ff5f57; } .mock-bar i:nth-child(2) { background: #febc2e; } .mock-bar i:nth-child(3) { background: #28c840; }
.mock-bar > span:first-of-type { margin-left: 8px; }
.live { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; color: var(--success); }
.live .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: pulseRing 1.6s infinite; }
.mock-body { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; padding: 16px; }
.tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; align-content: start; }
.tile { --tone: hsl(var(--h) 85% 62%); display: grid; gap: 2px; padding: 12px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); transition: transform .3s var(--spring), border-color .3s, background .3s, box-shadow .3s; }
.tile-ic { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; margin-bottom: 6px; color: var(--tone); background: color-mix(in srgb, var(--tone) 16%, transparent); }
.tile b { font-size: 13px; }
.tile small { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }
.tile.pressed { transform: scale(.93); border-color: color-mix(in srgb, var(--tone) 60%, transparent); background: color-mix(in srgb, var(--tone) 12%, transparent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--tone) 18%, transparent); }
.ticket { display: flex; flex-direction: column; padding: 14px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); min-height: 300px; }
.ticket-head { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 750; margin-bottom: 10px; }
.ticket-head span { font-family: var(--mono); color: var(--muted); font-weight: 500; }
.lines { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; position: relative; }
.lines li { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; font-size: 12.5px; padding: 7px 9px; border-radius: 9px; background: var(--surface-2); }
.qty { font-family: var(--mono); color: var(--accent-ink); font-weight: 700; }
.pr { font-family: var(--mono); }
.empty { font-size: 12px; color: var(--muted); padding: 10px 2px; }
.line-enter-active { transition: all .45s var(--spring); }
.line-leave-active { transition: all .25s ease; position: absolute; width: 100%; }
.line-enter-from { opacity: 0; transform: translateX(24px) scale(.9); }
.line-leave-to { opacity: 0; }
.line-move { transition: transform .35s var(--ease); }
.sums { margin-top: auto; padding-top: 12px; display: grid; gap: 4px; font-size: 12px; color: var(--muted); border-top: 1px dashed var(--border-2); }
.sums div { display: flex; justify-content: space-between; }
.sums span:last-child { font-family: var(--mono); }
.sums .tot { color: var(--text); font-weight: 800; font-size: 16px; margin-top: 4px; }
.charge { margin-top: 12px; height: 42px; border-radius: 12px; display: grid; place-items: center; font-weight: 750; font-size: 14px; color: #fff; background: var(--grad); background-size: 200% 200%; animation: gradientShift 6s ease infinite; transition: background .4s, box-shadow .4s; }
.charge span { display: inline-flex; align-items: center; gap: 8px; }
.charge.approved { background: var(--success); box-shadow: 0 12px 30px -12px var(--success); animation: popIn .5s var(--spring); }
.spinner { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .35); border-top-color: #fff; animation: spin .7s linear infinite; }
.swap-enter-active, .swap-leave-active { transition: opacity .2s ease, transform .25s var(--ease); }
.swap-enter-from { opacity: 0; transform: translateY(8px); }
.swap-leave-to { opacity: 0; transform: translateY(-8px); }

.float { position: absolute; display: flex; align-items: center; gap: 10px; padding: 10px 14px 10px 10px; border-radius: 14px; background: var(--panel); border: 1px solid var(--border-2); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); box-shadow: var(--shadow); font-size: 12.5px; animation: floaty 5s ease-in-out infinite; }
.float b { display: block; font-size: 13px; }
.float small { color: var(--muted); font-size: 11.5px; }
.fi { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; }
.fi.ok { color: var(--success); background: color-mix(in srgb, var(--success) 16%, transparent); }
.fi.warn { color: var(--warning); background: color-mix(in srgb, var(--warning) 16%, transparent); }
.fi.info { color: var(--info); background: color-mix(in srgb, var(--info) 16%, transparent); }
.f1 { top: -22px; right: 6%; }
.f2 { bottom: 14%; left: -36px; animation-delay: -1.6s; }
.f3 { bottom: -24px; right: 10%; animation-delay: -3.2s; }
.scroll-cue { position: absolute; left: 50%; bottom: 0; translate: -50% 0; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--border-2); background: var(--surface); color: var(--muted); display: grid; place-items: center; cursor: pointer; animation: floaty 2.4s ease-in-out infinite; }

/* Marquee */
.band { padding: 60px 0 10px; text-align: center; }
.band-label { font-size: 13px; color: var(--muted); font-weight: 600; letter-spacing: .02em; margin-bottom: 20px; }
.marquee { overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.track { display: flex; gap: 14px; width: max-content; animation: marquee 38s linear infinite; }
.marquee:hover .track { animation-play-state: paused; }
@keyframes marquee { to { transform: translateX(calc(-50% - 7px)); } }
.mq { display: inline-flex; align-items: center; gap: 9px; padding: 11px 20px; border-radius: 99px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-weight: 650; white-space: nowrap; }
.mq svg { color: var(--accent-ink); }

/* Stats */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; margin-top: 60px; border-radius: var(--r-xl); overflow: hidden; background: var(--border); border: 1px solid var(--border); }
.stat { padding: 30px 24px; background: color-mix(in srgb, var(--bg) 80%, transparent); text-align: center; }
.stat b { display: block; font-size: clamp(30px, 3.6vw, 42px); font-weight: 800; letter-spacing: -.04em; background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; font-variant-numeric: tabular-nums; }
.stat span { font-size: 13.5px; color: var(--muted); }

/* Section heads */
.sec-head { text-align: center; max-width: 720px; margin: 0 auto 50px; }
.eyebrow { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; color: var(--accent-ink); padding: 6px 12px; border-radius: 99px; background: color-mix(in srgb, var(--c1) 12%, transparent); border: 1px solid color-mix(in srgb, var(--c1) 22%, transparent); }
.sec-head h2, .show-copy h2, .cta h2 { font-size: clamp(30px, 4.4vw, 50px); font-weight: 800; letter-spacing: -.04em; line-height: 1.08; margin: 18px 0 14px; }
.sec-head p, .show-copy > p, .cta p { color: var(--text-2); font-size: 16.5px; line-height: 1.6; }

/* Bento */
.bento { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.span-2 { grid-column: span 2; }
.feat { position: relative; padding: 26px; border-radius: var(--r-xl); background: var(--panel); border: 1px solid var(--border); overflow: hidden; isolation: isolate; transition: transform .45s var(--ease), border-color .3s, opacity .8s var(--ease), filter .8s var(--ease); }
.feat::before { content: ''; position: absolute; inset: 0; z-index: -1; opacity: 0; transition: opacity .35s; background: radial-gradient(380px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--c1) 18%, transparent), transparent 60%); }
.feat:hover { transform: translateY(-4px); border-color: var(--border-2); }
.feat:hover::before { opacity: 1; }
.feat-ic { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 13px; color: #fff; background: var(--grad); box-shadow: 0 10px 24px -10px var(--c1); margin-bottom: 18px; }
.feat h3 { font-size: 18px; font-weight: 750; margin-bottom: 8px; }
.feat p { color: var(--text-2); line-height: 1.6; font-size: 14.5px; max-width: 460px; }
.v-keys { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.k { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border-2); border-bottom-width: 3px; background: var(--surface); font-family: var(--mono); font-size: 13px; font-weight: 700; }
.k small { font-family: var(--font); color: var(--muted); font-weight: 600; }
.feat:hover .k { animation: keyTap .5s var(--ease) both; }
.feat:hover .k:nth-child(2) { animation-delay: .08s; } .feat:hover .k:nth-child(3) { animation-delay: .16s; } .feat:hover .k:nth-child(4) { animation-delay: .24s; }
@keyframes keyTap { 40% { transform: translateY(2px); border-bottom-width: 1px; } }
.v-sync { position: relative; height: 34px; margin-top: 22px; }
.v-sync span { position: absolute; inset: 0 auto 0 0; display: inline-flex; align-items: center; gap: 6px; padding: 0 14px; border-radius: 99px; font-size: 13px; font-weight: 700; }
.sync-a { color: var(--warning); background: color-mix(in srgb, var(--warning) 14%, transparent); animation: syncA 5s infinite; }
.sync-b { color: var(--success); background: color-mix(in srgb, var(--success) 14%, transparent); animation: syncB 5s infinite; }
@keyframes syncA { 0%, 45% { opacity: 1; transform: none; } 55%, 100% { opacity: 0; transform: translateY(-8px); } }
@keyframes syncB { 0%, 45% { opacity: 0; transform: translateY(8px); } 55%, 100% { opacity: 1; transform: none; } }
.v-stock { display: grid; gap: 10px; margin-top: 20px; }
.srow { display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 10px; font-size: 12.5px; color: var(--text-2); }
.srow i { height: 7px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
.srow em { display: block; height: 100%; width: 0; border-radius: inherit; background: var(--grad); transition: width 1.4s var(--ease) .3s; }
.srow.low em { background: var(--warning); }
.feat.in .srow em { width: var(--w); }
.v-spark { width: 100%; height: 90px; margin-top: 14px; }
.v-spark .line { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 2s var(--ease) .3s; }
.v-spark .fill { opacity: 0; transition: opacity 1s ease 1.2s; }
.feat.in .v-spark .line { stroke-dashoffset: 0; }
.feat.in .v-spark .fill { opacity: 1; }
.v-avatars { display: flex; align-items: center; margin-top: 20px; }
.v-avatars span { width: 34px; height: 34px; border-radius: 50%; margin-right: -10px; border: 2px solid var(--bg-2); background: linear-gradient(135deg, hsl(var(--h) 80% 65%), hsl(calc(var(--h) + 40) 80% 55%)); transition: transform .35s var(--spring); }
.feat:hover .v-avatars span { transform: translateY(-4px); }
.feat:hover .v-avatars span:nth-child(2) { transition-delay: .05s; } .feat:hover .v-avatars span:nth-child(3) { transition-delay: .1s; } .feat:hover .v-avatars span:nth-child(4) { transition-delay: .15s; }
.v-avatars b { margin-left: 22px; font-size: 13px; color: var(--success); padding: 4px 10px; border-radius: 99px; background: color-mix(in srgb, var(--success) 14%, transparent); }
.v-pin { display: flex; gap: 12px; margin-top: 22px; }
.v-pin i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border-2); animation: pin 3.2s infinite; }
.v-pin i:nth-child(2) { animation-delay: .25s; } .v-pin i:nth-child(3) { animation-delay: .5s; } .v-pin i:nth-child(4) { animation-delay: .75s; }
@keyframes pin { 0%, 15% { background: transparent; border-color: var(--border-2); } 25%, 75% { background: var(--c1); border-color: var(--c1); transform: scale(1.1); } 85%, 100% { background: transparent; } }
.v-lock { display: inline-flex; align-items: center; gap: 7px; margin-top: 22px; padding: 7px 13px; border-radius: 99px; font-size: 13px; font-weight: 700; color: var(--accent-ink); background: color-mix(in srgb, var(--c1) 13%, transparent); }

/* Steps */
.steps { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.steps-line { position: absolute; top: 27px; left: 16.6%; right: 16.6%; height: 2px; background: var(--border); }
.steps-line span { display: block; height: 100%; background: var(--grad); transform: scaleX(0); transform-origin: left; transition: transform 1.6s var(--ease) .3s; }
.steps.in .steps-line span { transform: scaleX(1); }
.step { position: relative; text-align: center; padding: 0 12px; opacity: 0; transform: translateY(20px); transition: opacity .7s var(--ease), transform .7s var(--ease); transition-delay: calc(.3s + var(--i) * .45s); }
.steps.in .step { opacity: 1; transform: none; }
.step-n { display: inline-grid; place-items: center; width: 56px; height: 56px; border-radius: 18px; margin-bottom: 20px; font-size: 22px; font-weight: 800; color: #fff; background: var(--grad); box-shadow: 0 0 0 8px var(--bg), 0 16px 34px -12px var(--c1); }
.step h3 { font-size: 19px; font-weight: 750; margin-bottom: 8px; }
.step p { color: var(--text-2); line-height: 1.6; max-width: 300px; margin-inline: auto; }

/* Showcase */
.showcase { display: grid; grid-template-columns: 1fr 1.15fr; gap: clamp(32px, 5vw, 70px); align-items: center; }
.ticks { list-style: none; padding: 0; margin: 26px 0 0; display: grid; gap: 12px; }
.ticks li { display: flex; align-items: center; gap: 10px; font-weight: 600; }
.ticks svg { flex-shrink: 0; padding: 3px; width: 22px; height: 22px; border-radius: 7px; color: #fff; background: var(--grad); }
.dash { position: relative; padding: 24px; border-radius: var(--r-xl); }
.dash-tag { position: absolute; top: -11px; right: 18px; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; color: var(--muted); background: var(--bg-2); border: 1px solid var(--border-2); }
.install { display: grid; grid-template-columns: 1.3fr 1fr; gap: 32px; align-items: center; padding: clamp(28px, 5vw, 48px); border-radius: 32px; }
.install-copy h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 800; letter-spacing: -.04em; line-height: 1.08; margin: 16px 0 12px; }
.install-copy > p { color: var(--text-2); font-size: 16px; line-height: 1.6; }
.install-points { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.install-points li { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border); font-weight: 650; }
.install-points svg { color: var(--accent-ink); flex-shrink: 0; }
.install-note { margin-top: 14px; }
@media (max-width: 860px) { .install { grid-template-columns: 1fr; } }
.dash-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.dash-kpis > div { padding: 14px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); }
.dash-kpis small { display: block; font-size: 12px; color: var(--muted); }
.dash-kpis b { display: block; font-size: clamp(18px, 2vw, 24px); font-weight: 800; letter-spacing: -.03em; margin: 4px 0; font-variant-numeric: tabular-nums; }
.dash-kpis em { font-style: normal; font-size: 11.5px; font-weight: 700; }
.up { color: var(--success); }
.bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; align-items: end; height: 220px; margin-top: 22px; padding-top: 10px; }
.bar { display: grid; grid-template-rows: 1fr auto; height: 100%; gap: 8px; text-align: center; }
.bar small { font-size: 11.5px; color: var(--muted); }
.b { position: relative; align-self: end; height: calc(var(--v) * 1%); border-radius: 10px 10px 6px 6px; background: var(--grad-soft); border: 1px solid color-mix(in srgb, var(--c1) 30%, transparent); transform: scaleY(0); transform-origin: bottom; transition: transform 1.1s var(--spring), background .3s; transition-delay: calc(.25s + var(--i) * 80ms); }
.bar:nth-child(6) .b { background: var(--grad); }
.dash.in .b { transform: scaleY(1); }
.b em { position: absolute; top: -24px; left: 50%; translate: -50% 4px; font-style: normal; font-size: 11px; font-family: var(--mono); font-weight: 700; opacity: 0; transition: opacity .2s, translate .2s; }
.bar:hover .b em { opacity: 1; translate: -50% 0; }
.bar:hover .b { background: var(--grad); }

/* Faq */
.faq-wrap .sec-head { margin-bottom: 36px; }
.faq { max-width: 780px; margin-inline: auto; display: grid; gap: 10px; }
.qa { border-radius: var(--r-lg); background: var(--panel); border: 1px solid var(--border); transition: border-color .3s, background .3s, opacity .8s var(--ease), transform .9s var(--ease), filter .8s var(--ease); }
.qa.open { border-color: color-mix(in srgb, var(--c1) 35%, transparent); }
.qa button { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 20px 22px; background: none; border: 0; font-size: 16px; font-weight: 700; text-align: left; cursor: pointer; }
.pm { position: relative; flex-shrink: 0; width: 28px; height: 28px; border-radius: 9px; background: var(--surface-2); transition: background .3s, transform .4s var(--spring); }
.pm::before, .pm::after { content: ''; position: absolute; left: 50%; top: 50%; width: 12px; height: 2px; border-radius: 2px; background: currentColor; translate: -50% -50%; transition: transform .4s var(--spring); }
.pm::after { transform: rotate(90deg); }
.qa.open .pm { background: var(--grad); color: #fff; transform: rotate(180deg); }
.qa.open .pm::after { transform: rotate(0); }
.ans { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .45s var(--ease); }
.ans > div { overflow: hidden; }
.ans p { padding: 0 22px 20px; color: var(--text-2); line-height: 1.65; }
.qa.open .ans { grid-template-rows: 1fr; }

/* Cta */
.cta { position: relative; overflow: hidden; isolation: isolate; text-align: center; padding: clamp(48px, 7vw, 80px) 24px; border-radius: 32px; border: 1px solid var(--border-2); background: var(--panel); }
.cta > :deep(.brand-mark) { margin-inline: auto; animation: floaty 4s ease-in-out infinite, gradientShift 8s ease infinite; }
.cta p { max-width: 560px; margin-inline: auto; }
.cta-orb { position: absolute; z-index: -1; inset: -40%; background: conic-gradient(from 0deg, transparent, color-mix(in srgb, var(--c1) 30%, transparent), transparent 30%, color-mix(in srgb, var(--c3) 26%, transparent), transparent 60%); animation: spin 18s linear infinite; filter: blur(40px); }

/* Footer */
.foot { display: grid; grid-template-columns: 1fr auto; gap: 30px; padding: 80px 0 30px; }
.foot-brand p { color: var(--muted); margin-top: 10px; font-size: 14px; max-width: 340px; }
.foot-brand .say { margin-top: 6px; font-size: 13px; }
.foot-brand .say b { color: var(--text-2); letter-spacing: .02em; }
.foot-cols { display: flex; gap: 56px; }
.foot-cols div { display: grid; gap: 8px; align-content: start; }
.foot-cols b { font-size: 13px; margin-bottom: 4px; }
.foot-cols button { background: none; border: 0; padding: 0; text-align: left; color: var(--muted); font-size: 14px; cursor: pointer; transition: color .2s; }
.foot-cols button:hover { color: var(--text); }
.foot-bottom { grid-column: 1 / -1; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding-top: 24px; border-top: 1px solid var(--border); font-size: 13px; color: var(--muted); }

/* Phone-only pieces (hidden on larger screens) */
.mobile-cta, .menu-scrim, .feat-dots { display: none; }

/* Responsive
   ≥1600 wide: wider page, larger type
   ≤1020 tablet: hero and showcase stack
   ≤760  phone: burger menu, swipeable features, timeline steps, sticky CTA */
.nav-row { flex-wrap: nowrap; }
.hero-grid > *, .showcase > * { min-width: 0; }

@media (min-width: 1600px) {
  .landing { font-size: 16px; }
  .wrap { width: min(1360px, 100% - 80px); }
  .hero-title { font-size: clamp(70px, 3.5vw, 82px); }
  .hero-grid { grid-template-columns: 1fr 1.05fr; }
  .hero-sub { font-size: 20px; max-width: 600px; }
  .sec-head { max-width: 820px; }
  .sec-head h2, .show-copy h2, .cta h2 { font-size: clamp(50px, 3.2vw, 62px); }
  .feat { padding: 32px; }
  .feat h3 { font-size: 20px; }
  .feat p { font-size: 15.5px; }
  .bento { gap: 20px; }
  .mock-body { padding: 20px; gap: 18px; }
}
@media (max-width: 1020px) {
  .hero-grid, .showcase { grid-template-columns: 1fr; }
  .hero-copy { text-align: center; }
  .hero-sub { margin-inline: auto; }
  .hero-actions, .hero-proof { justify-content: center; }
  .hero-stage { max-width: 620px; margin: 30px auto 0; width: 100%; }
  .bento { grid-template-columns: 1fr 1fr; }
  .f2 { left: -14px; bottom: 6%; }
  .show-copy { text-align: center; }
  .ticks { justify-content: center; max-width: 520px; margin-inline: auto; text-align: left; }
}
@media (max-width: 760px) {
  .landing { font-size: 15px; }
  .nav-links, .hide-sm { display: none; }
  .burger { display: grid; }
  .wrap { width: calc(100% - 32px - var(--safe-l) - var(--safe-r)); }
  .nav { padding-top: var(--safe-t); }
  .nav-row { height: 62px; gap: 10px; }
  .logo { min-width: 0; flex-shrink: 1; }
  .nav-cta { margin-left: auto; gap: 6px; }

  /* menu: full-width panel under the bar */
  .mobile-menu {
    position: absolute; left: 0; right: 0; top: 100%;
    padding: 6px 16px calc(18px + var(--safe-b)); gap: 0;
    background: var(--bg); border-bottom: 1px solid var(--border); box-shadow: 0 30px 50px -30px rgba(0, 0, 0, .45);
    max-height: calc(100dvh - 62px - var(--safe-t)); overflow-y: auto;
  }
  .mm-link { display: flex; justify-content: space-between; align-items: center; width: 100%; min-height: 56px; background: none; border: 0; border-bottom: 1px solid var(--border); padding: 0 4px; font: 700 17px var(--font); color: var(--text); cursor: pointer; }
  .mm-link svg { color: var(--muted); }
  .mm-actions { display: grid; gap: 10px; margin-top: 18px; }
  .mobile-menu .btn { margin-top: 0; }
  .menu-scrim { display: block; position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, .35); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); }

  /* hero */
  .hero { padding: 26px 0 40px; }
  .pill { font-size: 12px; max-width: 100%; }
  .hero-title { font-size: clamp(36px, 10.6vw, 56px); margin: 18px 0 16px; letter-spacing: -.04em; }
  .hero-sub { font-size: 16px; }
  .hero-actions { margin-top: 24px; }
  .hero-actions .btn { flex: 1 1 220px; }
  .hero-proof { gap: 8px; margin-top: 20px; }
  .hero-proof li { padding: 6px 11px; border-radius: 99px; background: var(--surface-2); border: 1px solid var(--border); font-size: 12.5px; color: var(--text-2); }
  .scroll-cue { display: none; }
  .hero-stage { margin-top: 24px; }
  .float { display: none; }
  .mock { border-radius: 22px; }
  .mock-bar { padding: 10px 14px; }
  .mock-body { grid-template-columns: 1fr; padding: 12px; gap: 10px; }
  .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .tile { padding: 10px; border-radius: 12px; }
  .tile-ic { width: 28px; height: 28px; margin-bottom: 4px; }
  .tile b { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile small { font-size: 10.5px; }
  .ticket { min-height: 0; padding: 12px; }
  .lines { min-height: 64px; }

  /* band + stats */
  .band { padding-top: 34px; }
  .band-label { padding-inline: 20px; }
  .track { animation-duration: 28s; }
  .mq { padding: 9px 16px; font-size: 14px; }
  .stats { grid-template-columns: 1fr 1fr; margin-top: 36px; border-radius: 22px; }
  .stat { padding: 20px 14px; }
  .stat span { font-size: 12.5px; display: block; line-height: 1.4; }

  /* section heads */
  .section { padding-top: 64px; scroll-margin-top: 62px; }
  .sec-head { margin-bottom: 28px; }
  .sec-head h2, .show-copy h2, .cta h2 { font-size: clamp(28px, 8vw, 38px); margin: 14px 0 10px; }
  .sec-head p, .show-copy > p, .cta p { font-size: 15.5px; }

  /* features: swipe through them */
  .bento {
    display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
    margin-inline: calc(-16px - var(--safe-l)) calc(-16px - var(--safe-r)); padding: 4px 16px 8px; scroll-padding-inline: 16px;
    overscroll-behavior-x: contain;
  }
  .bento::-webkit-scrollbar { display: none; }
  .feat { flex: 0 0 min(84%, 360px); scroll-snap-align: start; padding: 22px; border-radius: 22px; }
  .feat h3 { font-size: 17px; }
  .feat p { font-size: 14.5px; }
  .span-2 { grid-column: auto; }
  .feat-dots { display: flex; justify-content: center; gap: 6px; margin-top: 14px; }
  .feat-dots button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 99px; background: var(--border-2); cursor: pointer; transition: width .35s var(--ease), background .3s; }
  .feat-dots button.on { width: 24px; background: var(--grad); }

  /* steps: vertical timeline */
  .steps { grid-template-columns: 1fr; gap: 22px; max-width: 520px; margin-inline: auto; }
  .steps-line { top: 28px; bottom: 28px; left: 27px; right: auto; width: 2px; height: auto; }
  .steps-line span { width: 100%; height: 100%; transform: scaleY(0); transform-origin: top; }
  .steps.in .steps-line span { transform: scaleY(1); }
  .step { display: grid; grid-template-columns: 56px 1fr; gap: 16px; align-items: start; text-align: left; padding: 0; }
  .step-n { margin: 0; }
  .step-text { padding-top: 4px; }
  .step h3 { font-size: 17px; margin-bottom: 4px; }
  .step p { margin: 0; font-size: 14.5px; max-width: none; }

  /* showcase */
  .ticks li { font-size: 14.5px; align-items: flex-start; }
  .dash { padding: 16px; border-radius: 22px; }
  .dash-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .dash-kpis > div { padding: 10px; border-radius: 12px; }
  .dash-kpis small { font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dash-kpis b { font-size: clamp(14px, 4.4vw, 19px); }
  .dash-kpis em { font-size: 10.5px; }
  .bars { height: 160px; gap: 6px; margin-top: 16px; }

  /* install */
  .install { border-radius: 24px; gap: 22px; text-align: center; }
  .install .hero-actions { justify-content: center; }
  .install-points li { padding: 12px 14px; font-size: 14px; text-align: left; }

  /* faq */
  .qa { border-radius: 16px; }
  .qa button { padding: 16px 16px; font-size: 15px; min-height: 58px; }
  .ans p { padding: 0 16px 16px; font-size: 14.5px; }

  /* cta + footer */
  .cta { padding: 44px 20px; border-radius: 24px; }
  .cta .hero-actions .btn { flex: 1 1 100%; }
  .foot { grid-template-columns: 1fr; gap: 26px; padding: 56px 0 calc(100px + var(--safe-b)); }
  .foot-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .foot-cols button { min-height: 32px; font-size: 14.5px; }
  .foot-bottom { flex-direction: column; }

  /* sticky call to action */
  .mobile-cta {
    position: fixed; z-index: 45; left: 0; right: 0; bottom: 0;
    display: flex; gap: 8px; padding: 10px max(12px, var(--safe-r)) calc(10px + var(--safe-b)) max(12px, var(--safe-l));
    background: color-mix(in srgb, var(--bg) 84%, transparent); border-top: 1px solid var(--border);
    backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4);
  }
  .mobile-cta .btn-primary { flex: 1; min-width: 0; }
  .bar-enter-active, .bar-leave-active { transition: transform .45s var(--ease), opacity .3s; }
  .bar-enter-from, .bar-leave-to { transform: translateY(100%); opacity: 0; }
}
@media (max-width: 380px) {
  .nav-cta .btn-primary { display: none; } /* still in the menu and the sticky bar */
  .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tiles .tile:nth-child(n + 5) { display: none; }
  .stat b { font-size: 28px; }
  .dash-kpis { grid-template-columns: 1fr; }
}
/* short landscape phones */
@media (max-height: 500px) and (orientation: landscape) {
  .hero { padding-top: 20px; }
  .hero-title { font-size: clamp(32px, 6vw, 48px); }
}
/* touch: no hover-only effects */
@media (hover: none) {
  .feat:hover { transform: none; }
  .feat:hover::before { opacity: 0; }
  .feat:hover .k { animation: none; }
  .bar .b em { opacity: 1; translate: -50% 0; font-size: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .reveal, .step { opacity: 1 !important; }
  .step { transform: none !important; }
  .srow em { width: var(--w); }
  .b { transform: none; }
  .v-spark .line { stroke-dashoffset: 0; }
  .v-spark .fill, .steps-line span { opacity: 1; transform: none; }
  .track { animation: none; flex-wrap: wrap; justify-content: center; width: auto; }
}
</style>

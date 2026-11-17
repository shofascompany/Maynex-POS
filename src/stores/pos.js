import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { uid, round2 } from '@/utils/format'
import { ROLES, LEGACY_ROLES } from '@/utils/constants'
import { createBlank, DEFAULT_SETTINGS } from './seed'

// v1 held the old demo store; v2 starts empty and is filled through first-run setup.
const KEY = 'tillo:data:v2'

const emptyCart = () => ({ items: [], customerId: null, discount: { type: 'percent', value: 0 }, note: '', redeemPoints: 0 })
const clone = (o) => JSON.parse(JSON.stringify(o))
const byIdMap = (list) => Object.fromEntries(list.map((x) => [x.id, x]))

/** A short, unique, lowercase login name from a person's name: "Jane Akello" -> "jane", then "jane2"… */
export function makeUsername(name, taken = []) {
  const used = new Set(taken.map((u) => (u || '').toLowerCase()))
  const base = (name || '').trim().split(/\s+/)[0].toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '').slice(0, 16) || 'staff'
  let u = base
  for (let n = 2; used.has(u); n++) u = base + n
  return u
}
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,23}$/

/** Fills in fields added by newer versions: today's role names, a username and the owner flag. */
function normalizeStaff(list) {
  const taken = []
  return list.map((s) => {
    const role = LEGACY_ROLES[s.role] || s.role
    let username = (s.username || '').toLowerCase()
    if (!username || taken.includes(username)) username = makeUsername(s.name, taken)
    taken.push(username)
    return { ...s, role, username, owner: !!s.owner }
  })
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const usePos = defineStore('pos', () => {
  const settings = ref({})
  const categories = ref([])
  const products = ref([])
  const customers = ref([])
  const staff = ref([])
  const orders = ref([])
  const held = ref([])
  const shifts = ref([])
  const counters = ref({ order: 1000 })
  const session = ref({ userId: null })
  const cart = ref(emptyCart())
  // The business this device is signed in to: { id, name, status, suspendedReason, email }. null = not signed in.
  const business = ref(null)

  function hydrate(d) {
    settings.value = { ...DEFAULT_SETTINGS, ...(d.settings || {}) }
    categories.value = d.categories || []
    products.value = d.products || []
    customers.value = d.customers || []
    staff.value = normalizeStaff(d.staff || [])
    business.value = d.business || null
    orders.value = d.orders || []
    held.value = d.held || []
    shifts.value = d.shifts || []
    counters.value = d.counters || { order: 1000 }
    session.value = d.session || { userId: null }
    cart.value = { ...emptyCart(), ...(d.cart || {}) }
  }
  hydrate(loadSaved() || createBlank())

  const snapshot = () => ({
    settings: settings.value, categories: categories.value, products: products.value,
    customers: customers.value, staff: staff.value, orders: orders.value, held: held.value,
    shifts: shifts.value, counters: counters.value, session: session.value, cart: cart.value, business: business.value,
  })

  let saveTimer
  watch(
    [settings, categories, products, customers, staff, orders, held, shifts, counters, session, cart, business],
    () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(KEY, JSON.stringify(snapshot()))
        } catch (e) {
          console.warn('Maynex POS: could not save data', e)
        }
      }, 250)
    },
    { deep: true },
  )

  // Getters
  const signedIn = computed(() => !!business.value?.id)
  const suspended = computed(() => business.value?.status === 'suspended')
  // a signed-in business with no active manager must create one before anyone can sign in
  const needsSetup = computed(() => signedIn.value && !staff.value.some((s) => s.active && s.role === 'manager'))
  const currentUser = computed(() => staff.value.find((s) => s.id === session.value.userId && s.active) || null)
  /** True when the signed-in worker's role has the permission (or any of them, when given a list). */
  const can = (perm) => {
    if (!currentUser.value) return false
    const perms = ROLES[currentUser.value.role]?.perms || []
    return Array.isArray(perm) ? perm.some((p) => perms.includes(p)) : perms.includes(perm)
  }
  const activeShift = computed(() => shifts.value.find((s) => !s.closedAt) || null)
  const categoryMap = computed(() => byIdMap(categories.value))
  const productMap = computed(() => byIdMap(products.value))
  const customerMap = computed(() => byIdMap(customers.value))
  const staffMap = computed(() => byIdMap(staff.value))
  const lowStock = computed(() =>
    products.value
      .filter((p) => p.active && p.trackStock && p.stock <= settings.value.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock),
  )
  const cartCustomer = computed(() => (cart.value.customerId ? customerMap.value[cart.value.customerId] || null : null))
  const cartCount = computed(() => cart.value.items.reduce((s, i) => s + i.qty, 0))

  const cartTotals = computed(() => {
    const s = settings.value
    const c = cart.value
    const lines = c.items.map((i) => {
      const gross = round2(i.price * i.qty)
      const disc = round2((gross * (i.discount || 0)) / 100)
      return { ...i, gross, disc, net: round2(gross - disc) }
    })
    const subtotal = round2(lines.reduce((a, l) => a + l.gross, 0))
    const lineDiscounts = round2(lines.reduce((a, l) => a + l.disc, 0))
    const afterLines = round2(subtotal - lineDiscounts)
    const dv = Math.max(0, Number(c.discount.value) || 0)
    const orderDiscount = round2(Math.min(afterLines, c.discount.type === 'percent' ? (afterLines * Math.min(dv, 100)) / 100 : dv))
    let pointsRedeemed = 0
    let pointsDiscount = 0
    const cust = cartCustomer.value
    if (s.loyaltyEnabled && cust && c.redeemPoints > 0 && s.pointValue > 0) {
      pointsRedeemed = Math.max(0, Math.min(cust.points, c.redeemPoints, Math.floor((afterLines - orderDiscount) / s.pointValue)))
      pointsDiscount = round2(pointsRedeemed * s.pointValue)
    }
    const discountTotal = round2(lineDiscounts + orderDiscount + pointsDiscount)
    const taxable = round2(afterLines - orderDiscount - pointsDiscount)
    const rate = (Number(s.taxRate) || 0) / 100
    let tax, total
    if (s.taxInclusive) {
      tax = round2(taxable - taxable / (1 + rate))
      total = taxable
    } else {
      tax = round2(taxable * rate)
      total = round2(taxable + tax)
    }
    return { lines, subtotal, lineDiscounts, orderDiscount, pointsRedeemed, pointsDiscount, discountTotal, taxable, tax, total }
  })

  // Auth
  /** Staff sign-in on this device: username (or staff id) + 4-digit PIN. */
  function login(pin, who) {
    const key = (who || '').trim().toLowerCase()
    const user = staff.value.find((s) => s.active && s.pin === pin && (!key || s.id === who || s.username === key))
    if (user) session.value = { userId: user.id, at: Date.now() }
    return user || null
  }
  /** After the owner signs in with email and password, open their own manager profile. */
  function loginOwner() {
    const managers = staff.value.filter((s) => s.active && s.role === 'manager')
    const user = managers.find((s) => s.owner) || managers[0] || null
    if (user) session.value = { userId: user.id, at: Date.now() }
    return user
  }
  function logout() {
    session.value = { userId: null }
  }

  // Cart
  const qtyInCart = (pid) => cart.value.items.filter((i) => i.productId === pid).reduce((s, i) => s + i.qty, 0)

  function addToCart(product, qty = 1) {
    if (product.trackStock && qtyInCart(product.id) + qty > product.stock) {
      return { ok: false, message: product.stock <= 0 ? `${product.name} is sold out` : `Only ${product.stock} × ${product.name} in stock` }
    }
    const line = cart.value.items.find((i) => i.productId === product.id)
    if (line) line.qty += qty
    else
      cart.value.items.push({
        key: uid('l_'), productId: product.id, name: product.name, icon: product.icon,
        price: product.price, cost: product.cost, categoryId: product.categoryId, qty, discount: 0,
      })
    return { ok: true }
  }
  function setQty(key, qty) {
    const l = cart.value.items.find((i) => i.key === key)
    if (!l) return { ok: false }
    qty = Math.floor(Number(qty) || 0)
    if (qty <= 0) {
      removeLine(key)
      return { ok: true }
    }
    const p = productMap.value[l.productId]
    if (p?.trackStock && qty > p.stock) return { ok: false, message: `Only ${p.stock} × ${p.name} in stock` }
    l.qty = qty
    return { ok: true }
  }
  function updateLine(key, patch) {
    const l = cart.value.items.find((i) => i.key === key)
    if (l) Object.assign(l, patch)
  }
  function removeLine(key) {
    cart.value.items = cart.value.items.filter((i) => i.key !== key)
  }
  function clearCart() {
    cart.value = emptyCart()
  }
  function setCustomer(id) {
    cart.value.customerId = id
    cart.value.redeemPoints = 0
  }
  function holdCart(label) {
    if (!cart.value.items.length) return null
    const h = {
      id: uid('h_'),
      label: label || cartCustomer.value?.name || `Sale ${held.value.length + 1}`,
      cart: clone(cart.value), total: cartTotals.value.total, count: cartCount.value,
      createdAt: Date.now(), staffId: currentUser.value?.id,
    }
    held.value.unshift(h)
    clearCart()
    return h
  }
  function resumeHeld(id) {
    const h = held.value.find((x) => x.id === id)
    if (!h) return
    if (cart.value.items.length) holdCart()
    held.value = held.value.filter((x) => x.id !== id)
    cart.value = { ...emptyCart(), ...h.cart }
  }
  function deleteHeld(id) {
    held.value = held.value.filter((x) => x.id !== id)
  }

  function checkout(payments) {
    const t = cartTotals.value
    if (!cart.value.items.length) throw new Error('Cart is empty')
    const paid = round2(payments.reduce((s, p) => s + p.amount, 0))
    if (paid + 0.001 < t.total) throw new Error('Payment is incomplete')
    const s = settings.value
    const cust = cartCustomer.value
    const pointsEarned = s.loyaltyEnabled && cust ? Math.floor(t.total * (Number(s.pointsPerUnit) || 0)) : 0
    counters.value.order++
    const order = {
      id: uid('o_'), number: counters.value.order, createdAt: Date.now(),
      items: t.lines.map((l) => ({
        productId: l.productId, name: l.name, icon: l.icon, categoryId: l.categoryId,
        price: l.price, cost: l.cost, qty: l.qty, discount: l.discount || 0, total: l.net,
      })),
      subtotal: t.subtotal, discount: t.discountTotal, tax: t.tax, total: t.total,
      taxRate: Number(s.taxRate) || 0, taxInclusive: !!s.taxInclusive,
      payments: payments.map((p) => ({ method: p.method, amount: round2(p.amount) })),
      change: round2(paid - t.total),
      customerId: cust?.id || null, staffId: currentUser.value?.id || null, shiftId: activeShift.value?.id || null,
      status: 'completed', note: cart.value.note || '', pointsEarned, pointsRedeemed: t.pointsRedeemed,
    }
    for (const l of order.items) {
      const p = productMap.value[l.productId]
      if (p?.trackStock) p.stock = Math.max(0, p.stock - l.qty)
    }
    if (cust) {
      cust.points = Math.max(0, (cust.points || 0) + pointsEarned - t.pointsRedeemed)
      cust.totalSpent = round2((cust.totalSpent || 0) + t.total)
      cust.visits = (cust.visits || 0) + 1
      cust.lastVisit = order.createdAt
    }
    orders.value.unshift(order)
    cart.value = emptyCart()
    return order
  }

  function refundOrder(id, { restock = true, reason = 'Customer request' } = {}) {
    const o = orders.value.find((x) => x.id === id)
    if (!o || o.status === 'refunded') return null
    o.status = 'refunded'
    o.refundedAt = Date.now()
    o.refundReason = reason
    o.refundedBy = currentUser.value?.id || null
    o.refundShiftId = activeShift.value?.id || null
    o.restocked = restock
    if (restock) {
      for (const l of o.items) {
        const p = productMap.value[l.productId]
        if (p?.trackStock) p.stock += l.qty
      }
    }
    const cust = customerMap.value[o.customerId]
    if (cust) {
      cust.points = Math.max(0, (cust.points || 0) - (o.pointsEarned || 0) + (o.pointsRedeemed || 0))
      cust.totalSpent = round2(Math.max(0, (cust.totalSpent || 0) - o.total))
      cust.visits = Math.max(0, (cust.visits || 0) - 1)
    }
    return o
  }

  // CRUD
  function upsert(listRef, item, prefix, defaults = {}) {
    if (item.id) {
      const i = listRef.value.findIndex((x) => x.id === item.id)
      if (i > -1) {
        listRef.value[i] = { ...listRef.value[i], ...item }
        return listRef.value[i]
      }
    }
    const created = { ...defaults, ...item, id: uid(prefix), createdAt: Date.now() }
    listRef.value.unshift(created)
    return created
  }

  const saveProduct = (p) => upsert(products, p, 'p_', { active: true, trackStock: true, stock: 0 })
  function deleteProduct(id) {
    products.value = products.value.filter((p) => p.id !== id)
    cart.value.items = cart.value.items.filter((i) => i.productId !== id)
  }
  function adjustStock(id, delta) {
    const p = productMap.value[id]
    if (p) p.stock = Math.max(0, Math.floor(p.stock + delta))
  }

  function saveCategory(c) {
    const saved = upsert(categories, c, 'c_')
    // keep categories in creation order (upsert unshifts new ones)
    if (!c.id) categories.value = [...categories.value.slice(1), saved]
    return saved
  }
  function deleteCategory(id) {
    categories.value = categories.value.filter((c) => c.id !== id)
    products.value.forEach((p) => {
      if (p.categoryId === id) p.categoryId = null
    })
  }

  const saveCustomer = (c) => upsert(customers, c, 'cu_', { points: 0, totalSpent: 0, visits: 0, lastVisit: null, notes: '' })
  function deleteCustomer(id) {
    customers.value = customers.value.filter((c) => c.id !== id)
    if (cart.value.customerId === id) setCustomer(null)
  }

  function saveStaff(s) {
    if (!ROLES[s.role]) return { ok: false, message: 'Choose a role' }
    s = { ...s, username: (s.username || '').trim().toLowerCase(), owner: !!s.owner }
    if (!USERNAME_RE.test(s.username)) return { ok: false, message: 'Username: 2–24 lowercase letters or numbers (dots, dashes and underscores allowed)' }
    if (staff.value.some((x) => x.username === s.username && x.id !== s.id)) return { ok: false, message: 'That username is already taken' }
    if (!/^\d{4}$/.test(s.pin || '')) return { ok: false, message: 'PIN must be exactly 4 digits' }
    if (staff.value.some((x) => x.pin === s.pin && x.id !== s.id)) return { ok: false, message: 'That PIN is already in use' }
    const managers = staff.value.filter((x) => x.role === 'manager' && x.active && x.id !== s.id)
    if (s.id && !managers.length && (s.role !== 'manager' || !s.active)) return { ok: false, message: 'Keep at least one active manager' }
    return { ok: true, item: upsert(staff, s, 's_', { active: true, owner: false }) }
  }
  function deleteStaff(id) {
    if (id === currentUser.value?.id) return { ok: false, message: "You can't remove yourself" }
    const target = staffMap.value[id]
    if (target?.role === 'manager' && staff.value.filter((x) => x.role === 'manager' && x.active).length <= 1)
      return { ok: false, message: 'Keep at least one active manager' }
    staff.value = staff.value.filter((x) => x.id !== id)
    return { ok: true }
  }

  // Shifts
  function openShift(float, note = '') {
    if (activeShift.value) return activeShift.value
    const s = {
      id: uid('sh_'), staffId: currentUser.value?.id, openedAt: Date.now(), closedAt: null,
      openingFloat: round2(float), movements: [], note,
    }
    shifts.value.unshift(s)
    return s
  }
  function addCashMovement(type, amount, reason) {
    const s = activeShift.value
    if (!s) return
    s.movements.push({ id: uid('m_'), type, amount: round2(amount), reason, at: Date.now(), by: currentUser.value?.id })
  }
  function shiftSummary(shift) {
    const list = orders.value.filter((o) => o.shiftId === shift.id)
    const sales = { cash: 0, card: 0, mobile: 0 }
    let total = 0
    for (const o of list) {
      total += o.total
      for (const p of o.payments) sales[p.method] = (sales[p.method] || 0) + p.amount
      sales.cash -= o.change || 0
    }
    let refunds = 0
    let cashRefunds = 0
    for (const o of orders.value) {
      if (o.refundShiftId !== shift.id) continue
      refunds += o.total
      const cashPaid = o.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0) - (o.change || 0)
      cashRefunds += Math.max(0, Math.min(o.total, cashPaid))
    }
    const cashIn = (shift.movements || []).filter((m) => m.type === 'in').reduce((s, m) => s + m.amount, 0)
    const cashOut = (shift.movements || []).filter((m) => m.type === 'out').reduce((s, m) => s + m.amount, 0)
    const expected = round2(shift.openingFloat + sales.cash + cashIn - cashOut - cashRefunds)
    return {
      orders: list.length, total: round2(total),
      sales: { cash: round2(sales.cash), card: round2(sales.card), mobile: round2(sales.mobile) },
      refunds: round2(refunds), cashRefunds: round2(cashRefunds),
      cashIn: round2(cashIn), cashOut: round2(cashOut), expected,
    }
  }
  function closeShift(counted, note = '') {
    const s = activeShift.value
    if (!s) return null
    const sum = shiftSummary(s)
    Object.assign(s, {
      closedAt: Date.now(), closedBy: currentUser.value?.id, note: note || s.note,
      expected: sum.expected, counted: round2(counted), difference: round2(counted - sum.expected),
    })
    return s
  }

  // Data
  const exportData = () => JSON.stringify({ app: 'maynex-pos', version: 1, exportedAt: Date.now(), ...snapshot() }, null, 2)
  function importData(text) {
    const d = JSON.parse(text)
    if (!d || !Array.isArray(d.products) || !d.settings) throw new Error('This file is not a Maynex POS backup')
    const keepUser = session.value.userId
    // a backup never changes which business this device belongs to
    hydrate({ ...d, business: business.value })
    session.value = { userId: staff.value.some((s) => s.id === keepUser) ? keepUser : null }
  }
  /** A brand-new business (just created on the server): empty store with the owner as its first manager. */
  function startBusiness(biz, storeSettings, { name, pin }) {
    const manager = {
      id: uid('s_'), name: name.trim(), username: makeUsername(name), role: 'manager', pin,
      color: '#7c5cff', owner: true, active: true, createdAt: Date.now(),
    }
    hydrate({ ...createBlank({ ...storeSettings, theme: settings.value.theme }, manager), business: biz })
    session.value = { userId: manager.id, at: Date.now() }
    return manager
  }
  /** Data already on this device from before it belonged to any business (products, customers or sales). */
  const hasUnclaimedData = computed(() => !business.value && (products.value.length > 0 || orders.value.length > 0 || customers.value.length > 0))
  /** A brand-new business that takes over the data already on this device; the owner becomes a manager. */
  function adoptIntoBusiness(biz, storeSettings, { name, pin }) {
    Object.assign(settings.value, storeSettings)
    business.value = biz
    staff.value = staff.value.filter((s) => s.pin !== pin).map((s) => ({ ...s, owner: false }))
    const manager = {
      id: uid('s_'), name: name.trim(), username: makeUsername(name, staff.value.map((s) => s.username)),
      role: 'manager', pin, color: '#7c5cff', owner: true, active: true, createdAt: Date.now(),
    }
    staff.value.unshift(manager)
    session.value = { userId: manager.id, at: Date.now() }
    return manager
  }
  /** This device signed in to an existing business: start empty and let sync download the shop. */
  function enterBusiness(biz) {
    const keepTheme = settings.value.theme
    if (business.value?.id !== biz.id) hydrate({ ...createBlank({ theme: keepTheme }), business: biz })
    else business.value = { ...business.value, ...biz }
  }
  /** Signs this device out of the business and forgets its local copy (the cloud keeps everything). */
  function leaveBusiness() {
    hydrate(createBlank({ theme: settings.value.theme }))
  }
  /** Used when a business has no active manager left (e.g. removed by the platform admin). */
  function createManager({ name, pin }) {
    if (!name?.trim()) return { ok: false, message: 'Enter your name' }
    if (!/^\d{4}$/.test(pin || '')) return { ok: false, message: 'PIN must be exactly 4 digits' }
    if (staff.value.some((x) => x.pin === pin)) return { ok: false, message: 'That PIN is already in use' }
    const m = {
      id: uid('s_'), name: name.trim(), username: makeUsername(name, staff.value.map((s) => s.username)),
      role: 'manager', pin, color: '#7c5cff', owner: !staff.value.some((s) => s.owner && s.active), active: true, createdAt: Date.now(),
    }
    staff.value.push(m)
    session.value = { userId: m.id, at: Date.now() }
    return { ok: true, user: m }
  }
  function clearAll() {
    hydrate({ ...createBlank(settings.value, currentUser.value), business: business.value })
  }

  return {
    settings, categories, products, customers, staff, orders, held, shifts, counters, session, cart, business,
    signedIn, suspended, needsSetup, hasUnclaimedData, currentUser, activeShift, categoryMap, productMap, customerMap, staffMap, lowStock, cartCustomer, cartCount, cartTotals,
    can, login, loginOwner, logout,
    qtyInCart, addToCart, setQty, updateLine, removeLine, clearCart, setCustomer, holdCart, resumeHeld, deleteHeld, checkout, refundOrder,
    saveProduct, deleteProduct, adjustStock, saveCategory, deleteCategory, saveCustomer, deleteCustomer, saveStaff, deleteStaff,
    openShift, addCashMovement, closeShift, shiftSummary,
    exportData, importData, startBusiness, adoptIntoBusiness, enterBusiness, leaveBusiness, createManager, clearAll,
  }
})

import { round2, startOfDay, addDays, formatShortDate, hourLabel, fromDateInput, DAY } from './format'
import { PAYMENT_METHODS } from './constants'

const valid = (o) => o.status !== 'refunded'

export const inRange = (orders, from, to) => orders.filter((o) => o.createdAt >= from && o.createdAt < to)

export function summarize(orders) {
  let gross = 0, discounts = 0, tax = 0, revenue = 0, cogs = 0, items = 0, refunds = 0, refundCount = 0, count = 0
  for (const o of orders) {
    if (!valid(o)) {
      refunds += o.total
      refundCount++
      continue
    }
    count++
    gross += o.subtotal
    discounts += o.discount
    tax += o.tax
    revenue += o.total
    for (const i of o.items) {
      cogs += (i.cost || 0) * i.qty
      items += i.qty
    }
  }
  const net = revenue - tax
  const profit = net - cogs
  return {
    gross: round2(gross), discounts: round2(discounts), tax: round2(tax), revenue: round2(revenue),
    net: round2(net), cogs: round2(cogs), profit: round2(profit), margin: net ? (profit / net) * 100 : 0,
    items, refunds: round2(refunds), refundCount, count, avg: count ? revenue / count : 0,
  }
}

export function salesByDay(orders, from, days) {
  const buckets = []
  const index = new Map()
  for (let i = 0; i < days; i++) {
    const ts = addDays(from, i)
    index.set(ts, buckets.length)
    buckets.push({ ts, label: formatShortDate(ts), value: 0, count: 0 })
  }
  for (const o of orders) {
    if (!valid(o)) continue
    const i = index.get(startOfDay(o.createdAt))
    if (i === undefined) continue
    buckets[i].value = round2(buckets[i].value + o.total)
    buckets[i].count++
  }
  return buckets.map((b) => ({ ...b, sub: `${b.count} order${b.count === 1 ? '' : 's'}` }))
}

export function salesByHour(orders, fromHour = 0, toHour = 23) {
  const b = Array.from({ length: 24 }, (_, h) => ({ h, label: hourLabel(h), value: 0, count: 0 }))
  for (const o of orders) {
    if (!valid(o)) continue
    const h = new Date(o.createdAt).getHours()
    b[h].value = round2(b[h].value + o.total)
    b[h].count++
  }
  return b.slice(fromHour, toHour + 1).map((x) => ({ ...x, sub: `${x.count} order${x.count === 1 ? '' : 's'}` }))
}

export function byCategory(orders, categoryMap) {
  const m = new Map()
  for (const o of orders) {
    if (!valid(o)) continue
    for (const i of o.items) {
      const k = i.categoryId || 'none'
      m.set(k, (m.get(k) || 0) + i.total)
    }
  }
  return [...m]
    .map(([id, v]) => ({
      id,
      label: categoryMap[id]?.name || 'Uncategorized',
      icon: categoryMap[id]?.icon || '',
      color: categoryMap[id]?.color || '#94a3b8',
      value: round2(v),
    }))
    .sort((a, b) => b.value - a.value)
}

export function byPayment(orders) {
  const r = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, 0]))
  for (const o of orders) {
    if (!valid(o)) continue
    for (const p of o.payments) r[p.method] = (r[p.method] || 0) + p.amount
    r.cash -= o.change || 0
  }
  return PAYMENT_METHODS.map((m) => ({ label: m.label, color: m.color, value: round2(Math.max(0, r[m.id])) }))
}

export function topProducts(orders, limit = 10) {
  const m = new Map()
  for (const o of orders) {
    if (!valid(o)) continue
    for (const i of o.items) {
      const k = i.productId || i.name
      const e = m.get(k) || { id: k, name: i.name, icon: i.icon, qty: 0, revenue: 0, cost: 0 }
      e.qty += i.qty
      e.revenue += i.total
      e.cost += (i.cost || 0) * i.qty
      m.set(k, e)
    }
  }
  return [...m.values()]
    .map((e) => ({ ...e, revenue: round2(e.revenue), profit: round2(e.revenue - e.cost) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

export function byStaff(orders, staffMap) {
  const m = new Map()
  for (const o of orders) {
    if (!valid(o)) continue
    const e = m.get(o.staffId) || { id: o.staffId, count: 0, revenue: 0 }
    e.count++
    e.revenue += o.total
    m.set(o.staffId, e)
  }
  return [...m.values()]
    .map((e) => ({
      ...e,
      name: staffMap[e.id]?.name || 'Former staff',
      color: staffMap[e.id]?.color || '#94a3b8',
      revenue: round2(e.revenue),
      avg: e.count ? e.revenue / e.count : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

function mk(from, to, label) {
  return { from, to, label, days: Math.max(1, Math.round((to - from) / DAY)) }
}

export function rangeFor(key, custom = {}) {
  const t = startOfDay()
  switch (key) {
    case 'today': return mk(t, addDays(t, 1), 'Today')
    case 'yesterday': return mk(addDays(t, -1), t, 'Yesterday')
    case '30d': return mk(addDays(t, -29), addDays(t, 1), 'Last 30 days')
    case 'month': {
      const d = new Date(t)
      d.setDate(1)
      return mk(d.getTime(), addDays(t, 1), 'This month')
    }
    case 'custom': {
      let f = custom.from ? fromDateInput(custom.from) : addDays(t, -6)
      let to = custom.to ? addDays(fromDateInput(custom.to), 1) : addDays(t, 1)
      if (to <= f) to = addDays(f, 1)
      return mk(f, to, 'Custom range')
    }
    default: return mk(addDays(t, -6), addDays(t, 1), 'Last 7 days')
  }
}

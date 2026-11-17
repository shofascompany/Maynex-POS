export const DAY = 86400000

export const uid = (prefix = '') =>
  prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)

export const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100

const cache = new Map()
function nf(currency, opts = {}) {
  const key = currency + JSON.stringify(opts)
  if (!cache.has(key)) {
    try {
      cache.set(key, new Intl.NumberFormat(undefined, { style: 'currency', currency, ...opts }))
    } catch {
      cache.set(key, new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', ...opts }))
    }
  }
  return cache.get(key)
}

export const formatMoney = (v, currency = 'USD') => nf(currency).format(Number(v) || 0)
export const formatMoneyCompact = (v, currency = 'USD') =>
  nf(currency, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v) || 0)
export const formatNumber = (v, digits = 0) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(Number(v) || 0)

export const formatDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
export const formatShortDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
export const formatDateTime = (ts) => `${formatDate(ts)}, ${formatTime(ts)}`
export const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return formatShortDate(ts)
}

export function duration(ms) {
  const m = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

export const startOfDay = (d = Date.now()) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}
export const addDays = (ts, n) => {
  const x = new Date(ts)
  x.setDate(x.getDate() + n)
  return x.getTime()
}

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?'

export const toDateInput = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const fromDateInput = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function toCSV(rows) {
  return rows
    .map((r) =>
      r.map((v) => {
        const s = String(v ?? '')
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }).join(','),
    )
    .join('\n')
}

export function download(filename, content, type = 'text/csv') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// null when there is nothing to compare against (no previous value), so callers can hide the change.
export const pctChange = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null)

// "Latte, Croissant +2" for compact order lists.
export function itemsSummary(items = [], show = 2) {
  const names = items.map((i) => i.name)
  const head = names.slice(0, show).join(', ')
  return names.length > show ? `${head} +${names.length - show}` : head
}

export const randomBarcode = () => {
  let s = '20'
  for (let i = 0; i < 11; i++) s += Math.floor(Math.random() * 10)
  return s
}

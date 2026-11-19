import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { usePos } from './pos'
import { getClient, getConfig, saveConfig, friendlyError } from '@/lib/supabase'

// Local collection -> Supabase table. `cols` are the local (camelCase) fields that are stored.
const COLLECTIONS = [
  { key: 'categories', table: 'categories', order: 'asc', cols: ['id', 'name', 'icon', 'color', 'createdAt'] },
  {
    key: 'products', table: 'products', order: 'asc',
    cols: ['id', 'name', 'categoryId', 'price', 'cost', 'icon', 'trackStock', 'barcode', 'sku', 'stock', 'active', 'createdAt'],
  },
  {
    key: 'customers', table: 'customers', order: 'asc',
    cols: ['id', 'name', 'phone', 'email', 'notes', 'points', 'totalSpent', 'visits', 'lastVisit', 'createdAt'],
  },
  { key: 'staff', table: 'staff', order: 'asc', cols: ['id', 'name', 'username', 'role', 'pin', 'color', 'owner', 'active', 'createdAt'] },
  {
    key: 'shifts', table: 'shifts', order: 'desc', sortKey: 'openedAt',
    cols: ['id', 'staffId', 'closedBy', 'openedAt', 'closedAt', 'openingFloat', 'movements', 'note', 'expected', 'counted', 'difference'],
  },
  {
    key: 'orders', table: 'orders', order: 'desc',
    cols: [
      'id', 'number', 'createdAt', 'items', 'subtotal', 'discount', 'tax', 'total', 'taxRate', 'taxInclusive',
      'payments', 'change', 'customerId', 'staffId', 'shiftId', 'status', 'note', 'pointsEarned', 'pointsRedeemed',
      'refundedAt', 'refundReason', 'refundedBy', 'refundShiftId', 'restocked',
    ],
  },
  { key: 'held', table: 'held_sales', order: 'desc', cols: ['id', 'label', 'cart', 'total', 'count', 'staffId', 'createdAt'] },
]
const BY_KEY = Object.fromEntries(COLLECTIONS.map((c) => [c.key, c]))
const TIME_FIELDS = new Set(['createdAt', 'lastVisit', 'refundedAt', 'openedAt', 'closedAt'])
const DEVICE_ONLY_SETTINGS = ['theme']
const HASH_KEY = 'tillo:sync:v1'
const PENDING_KEY = 'maynex:pending-signup'

const snake = (s) => s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())

function fromRow(c, row) {
  const obj = {}
  for (const k of c.cols) {
    let v = row[snake(k)]
    if (v === null || v === undefined) continue
    if (TIME_FIELDS.has(k)) v = Date.parse(v)
    obj[k] = v
  }
  return obj
}

// Key-order independent serialisation, so jsonb round trips don't look like edits.
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']'
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
  }
  return JSON.stringify(v ?? null)
}
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
const hashOf = (v) => cyrb53(stable(v))

function sortList(c, list) {
  const k = c.sortKey || 'createdAt'
  return list.sort((a, b) => (c.order === 'desc' ? (b[k] || 0) - (a[k] || 0) : (a[k] || 0) - (b[k] || 0)))
}

const bizFromRow = (b, email) => ({
  id: b.id, name: b.name, status: b.status, suspendedReason: b.suspended_reason || '', email: email || '',
  businessType: b.business_type || '', country: b.country || '', city: b.city || '', code: b.code || '',
})
// set while a team member is signed in through a browser with the shop code (not an owner-linked device)
const WEB_SESSION_KEY = 'maynex:staff-web-session'

export const useSync = defineStore('sync', () => {
  const pos = usePos()

  // disabled | connecting | signed-out | syncing | synced | error | suspended
  const status = ref('disabled')
  const error = ref('')
  const email = ref('')
  const lastSyncedAt = ref(null)
  const configured = ref(false)
  const fromEnv = ref(false)
  const projectUrl = ref('')
  // platform-wide notice and sign-up switch, set by the platform admin
  const platform = ref({ allowSignups: true, announcement: '', tone: 'info' })
  // true after the owner opened a password-reset link: the app asks for a new password
  const recovering = ref(false)

  let sb = null
  let channel = null
  let authSub = null
  let active = false
  let stops = []
  const timers = {}
  const running = {}
  let bid = null
  // Hash of every row as last confirmed by the server, so only real edits are pushed.
  // Keyed by server URL + business, so another shop's rows are never mistaken for local deletes.
  let hashes = { id: '', known: false, maps: {}, settings: null, profile: null }

  const online = computed(() => ['synced', 'syncing'].includes(status.value))

  function loadHashes(url, businessId) {
    const id = url + '|' + businessId
    try {
      const h = JSON.parse(localStorage.getItem(HASH_KEY) || 'null')
      if (h && h.id === id) return h
    } catch {
      // fall through
    }
    return { id, known: false, maps: {}, settings: null, profile: null }
  }
  function saveHashes() {
    try {
      localStorage.setItem(HASH_KEY, JSON.stringify(hashes))
    } catch {
      // storage full: the next reconcile will simply compare more rows
    }
  }

  function fail(e) {
    status.value = 'error'
    error.value = friendlyError(e)
    console.warn('Sync error:', e)
  }
  function markSynced() {
    status.value = pos.suspended ? 'suspended' : 'synced'
    error.value = ''
    lastSyncedAt.value = Date.now()
  }
  const must = ({ error: err, data }) => {
    if (err) throw err
    return data
  }

  function toRow(c, obj) {
    const row = { business_id: bid }
    for (const k of c.cols) {
      let v = obj[k]
      if (v === undefined) v = null
      if (TIME_FIELDS.has(k)) v = v ? new Date(v).toISOString() : null
      row[snake(k)] = v
    }
    return row
  }

  const sharedSettings = () => {
    const copy = JSON.parse(JSON.stringify(pos.settings))
    for (const k of DEVICE_ONLY_SETTINGS) delete copy[k]
    return copy
  }
  const profileOf = (s) => ({ name: s.storeName || '', phone: s.phone || '', currency: s.currency || '' })

  async function fetchAll(table) {
    const out = []
    for (let from = 0; ; from += 1000) {
      const data = must(await sb.from(table).select('*').eq('business_id', bid).range(from, from + 999))
      out.push(...data)
      if (data.length < 1000) break
    }
    return out
  }
  async function upsertRows(table, rows) {
    for (let i = 0; i < rows.length; i += 500) must(await sb.from(table).upsert(rows.slice(i, i + 500)))
  }
  async function deleteIds(table, ids) {
    for (let i = 0; i < ids.length; i += 200) must(await sb.from(table).delete().eq('business_id', bid).in('id', ids.slice(i, i + 200)))
  }
  async function upsertSettings(data) {
    must(await sb.from('business_settings').upsert({ business_id: bid, data }))
    hashes.settings = hashOf(data)
    // keep the business directory (seen by the platform admin) in step with the profile
    const profile = profileOf(data)
    const ph = hashOf(profile)
    if (ph !== hashes.profile && profile.name) {
      must(await sb.rpc('update_business_profile', { bid, p: profile }))
      hashes.profile = ph
      if (pos.business) pos.business.name = profile.name
    }
  }

  /**
   * Brings this device and the cloud together:
   * - first connection: cloud rows are loaded and rows that exist only on this device are uploaded
   *   (nothing is ever deleted on a first connection);
   * - later connections: edits and deletions made while offline are pushed, then the cloud copy is loaded.
   */
  async function reconcile() {
    const remote = {}
    for (const c of COLLECTIONS) remote[c.key] = await fetchAll(c.table)
    const settingsRow = must(await sb.from('business_settings').select('data').eq('business_id', bid).maybeSingle())

    for (const c of COLLECTIONS) {
      const map = hashes.maps[c.key] || {}
      const merged = new Map(remote[c.key].map((r) => {
        const o = fromRow(c, r)
        return [o.id, o]
      }))
      const ups = []
      if (hashes.known) {
        const localIds = new Set()
        for (const o of pos[c.key]) {
          localIds.add(o.id)
          const row = toRow(c, o)
          if (map[o.id] !== hashOf(row)) {
            ups.push(row)
            merged.set(o.id, o)
          }
        }
        const dels = Object.keys(map).filter((id) => !localIds.has(id))
        if (dels.length) {
          await deleteIds(c.table, dels)
          dels.forEach((id) => merged.delete(id))
        }
      } else {
        for (const o of pos[c.key]) {
          if (!merged.has(o.id)) {
            ups.push(toRow(c, o))
            merged.set(o.id, o)
          }
        }
      }
      if (ups.length) await upsertRows(c.table, ups)
      const list = sortList(c, [...merged.values()])
      const newMap = {}
      for (const o of list) newMap[o.id] = hashOf(toRow(c, o))
      hashes.maps[c.key] = newMap
      pos[c.key] = list
    }

    const local = sharedSettings()
    if (hashes.known && hashes.settings !== hashOf(local)) await upsertSettings(local)
    else if (settingsRow?.data && Object.keys(settingsRow.data).length) {
      Object.assign(pos.settings, settingsRow.data)
      hashes.settings = hashOf(sharedSettings())
      hashes.profile = hashOf(profileOf(pos.settings))
    } else await upsertSettings(local)

    pos.counters.order = Math.max(pos.counters.order, 1000, ...pos.orders.map((o) => o.number || 0))
    hashes.known = true
    saveHashes()
  }

  async function flushCollection(c) {
    if (c.key === 'products') await flushCollection(BY_KEY.categories)
    const map = (hashes.maps[c.key] ||= {})
    const ups = []
    const upHashes = []
    const seen = new Set()
    for (const o of pos[c.key]) {
      seen.add(o.id)
      const row = toRow(c, o)
      const h = hashOf(row)
      if (map[o.id] !== h) {
        ups.push(row)
        upHashes.push([o.id, h])
      }
    }
    const dels = Object.keys(map).filter((id) => !seen.has(id))
    if (!ups.length && !dels.length) return
    status.value = 'syncing'
    if (ups.length) {
      await upsertRows(c.table, ups)
      for (const [id, h] of upHashes) map[id] = h
    }
    if (dels.length) {
      await deleteIds(c.table, dels)
      for (const id of dels) delete map[id]
    }
    saveHashes()
  }
  async function flushSettings() {
    const data = sharedSettings()
    if (hashOf(data) === hashes.settings) return
    status.value = 'syncing'
    await upsertSettings(data)
    saveHashes()
  }
  function schedule(key, delay = 700) {
    clearTimeout(timers[key])
    timers[key] = setTimeout(() => flush(key), delay)
  }
  async function flush(key) {
    if (!active || pos.suspended) return
    if (running[key]) return schedule(key, 500)
    running[key] = true
    try {
      if (key === 'settings') await flushSettings()
      else await flushCollection(BY_KEY[key])
      markSynced()
    } catch (e) {
      fail(e)
      schedule(key, 15000)
    } finally {
      running[key] = false
    }
  }
  function flushAllSoon() {
    for (const c of COLLECTIONS) schedule(c.key, 100)
    schedule('settings', 100)
  }

  function applyRemote(c, payload) {
    const map = (hashes.maps[c.key] ||= {})
    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id
      if (!id || !(id in map)) return
      delete map[id]
      pos[c.key] = pos[c.key].filter((x) => x.id !== id)
    } else {
      if (payload.new?.business_id !== bid) return
      const obj = fromRow(c, payload.new)
      const h = hashOf(toRow(c, obj))
      if (map[obj.id] === h) return // our own write coming back
      map[obj.id] = h
      const list = pos[c.key]
      const i = list.findIndex((x) => x.id === obj.id)
      if (i > -1) list[i] = obj
      else if (c.order === 'desc') list.unshift(obj)
      else list.push(obj)
      if (c.key === 'orders') pos.counters.order = Math.max(pos.counters.order, obj.number || 0)
    }
    saveHashes()
    lastSyncedAt.value = Date.now()
  }
  function applyRemoteSettings(payload) {
    const data = payload.new?.data
    if (!data || payload.new?.business_id !== bid) return
    const h = hashOf(data)
    if (h === hashes.settings) return
    hashes.settings = h
    Object.assign(pos.settings, data)
    saveHashes()
    lastSyncedAt.value = Date.now()
  }
  function applyBusiness(payload) {
    if (payload.eventType === 'DELETE') {
      // the platform admin removed this business: sign the device out
      signOutBusiness()
      return
    }
    const b = payload.new
    if (!b || b.id !== bid) return
    const wasSuspended = pos.suspended
    pos.business = { ...pos.business, ...bizFromRow(b, pos.business?.email) }
    if (wasSuspended && !pos.suspended) {
      // reactivated: catch up on anything sold offline while suspended
      syncNow().catch(() => {})
    } else if (pos.suspended) status.value = 'suspended'
  }

  async function loadPlatform() {
    if (!sb) return
    try {
      const row = must(await sb.from('platform_settings').select('*').eq('id', 'main').maybeSingle())
      if (row) platform.value = { allowSignups: row.allow_signups, announcement: row.announcement || '', tone: row.announcement_tone || 'info' }
    } catch {
      // keep the last known value
    }
  }

  function subscribe() {
    if (channel) sb.removeChannel(channel)
    channel = sb.channel('maynex-sync-' + bid)
    const filter = `business_id=eq.${bid}`
    for (const c of COLLECTIONS) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: c.table, filter }, (p) => applyRemote(c, p))
      // deletes can't be filtered server-side; applyRemote ignores ids this device doesn't know
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: c.table }, (p) => applyRemote(c, p))
    }
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'business_settings', filter }, applyRemoteSettings)
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `id=eq.${bid}` }, applyBusiness)
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'platform_settings' }, (p) => {
      const r = p.new
      if (r) platform.value = { allowSignups: r.allow_signups, announcement: r.announcement || '', tone: r.announcement_tone || 'info' }
    })
    channel.subscribe()
  }
  function startWatchers() {
    stopWatchers()
    for (const c of COLLECTIONS) stops.push(watch(() => pos[c.key], () => schedule(c.key), { deep: true }))
    stops.push(watch(() => pos.settings, () => schedule('settings'), { deep: true }))
  }
  function stopWatchers() {
    stops.forEach((s) => s())
    stops = []
  }

  function stop(next = 'signed-out') {
    active = false
    stopWatchers()
    Object.values(timers).forEach(clearTimeout)
    if (channel && sb) sb.removeChannel(channel)
    channel = null
    email.value = ''
    status.value = next
  }

  /** Finds the business this login belongs to, creating it first if a sign-up was waiting for email confirmation. */
  async function membership(session) {
    const row = must(await sb.from('business_members').select('business_id, role, businesses(*)').eq('user_id', session.user.id).maybeSingle())
    if (row?.businesses) return row.businesses
    const pending = readPending()
    if (pending && pending.email === session.user.email?.toLowerCase()) {
      const b = must(await sb.rpc('create_business', { p: pending.payload }))
      return { ...b, _pending: pending }
    }
    return null
  }

  async function connect(session) {
    email.value = session.user.email
    status.value = 'syncing'
    try {
      const b = await membership(session)
      if (!b) {
        // no business for this login (never created, or removed by the platform admin)
        await sb.auth.signOut()
        stop('signed-out')
        if (pos.signedIn) {
          localStorage.removeItem(HASH_KEY)
          pos.leaveBusiness()
        }
        throw new Error('This login has no business. Create your business to get started.')
      }
      const biz = bizFromRow(b, session.user.email)
      if (b._pending) {
        // the sign-up finished after email confirmation: set up the shop on this device now
        const { settings, owner, adopt } = b._pending
        if (adopt && pos.hasUnclaimedData) pos.adoptIntoBusiness(biz, settings, owner)
        else pos.startBusiness(biz, settings, owner)
        clearPending()
      } else pos.enterBusiness(biz)
      bid = biz.id
      hashes = loadHashes(getConfig().url, bid)
      if (pos.suspended) {
        // suspended: the server refuses writes; keep the device read-only and listen for reactivation
        stop('suspended')
        email.value = session.user.email
        subscribe()
        return
      }
      await reconcile()
      subscribe()
      active = true
      startWatchers()
      markSynced()
    } catch (e) {
      if (status.value !== 'signed-out') fail(e)
      throw e
    }
  }

  async function init() {
    const config = getConfig()
    configured.value = !!config
    fromEnv.value = !!config?.fromEnv
    projectUrl.value = config?.url || ''
    if (!config) return stop('disabled')
    sb = getClient()
    loadPlatform()
    authSub?.unsubscribe()
    authSub = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') stop('signed-out')
      if (event === 'PASSWORD_RECOVERY') recovering.value = true
    }).data.subscription
    status.value = 'connecting'
    try {
      const { data } = await sb.auth.getSession()
      if (data.session) await connect(data.session)
      else status.value = 'signed-out'
    } catch {
      // status and error were set by connect(); local data keeps working offline
    }
  }

  function readPending() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')
    } catch {
      return null
    }
  }
  function clearPending() {
    localStorage.removeItem(PENDING_KEY)
  }

  /**
   * Creates the owner login and the business. Returns { confirmEmail: true } when Supabase is set to
   * require email confirmation; the business is then created on the first sign-in.
   */
  async function signUpBusiness({ email: mail, password, business, settings, owner, adopt }) {
    if (!sb) throw new Error('The server is not connected yet.')
    await loadPlatform()
    if (!platform.value.allowSignups) throw new Error('New sign-ups are closed right now. Please try again later.')
    error.value = ''
    const payload = { ...business, settings }
    const normalized = mail.trim().toLowerCase()
    const res = await sb.auth.signUp({ email: normalized, password })
    if (res.error) throw new Error(friendlyError(res.error))
    if (!res.data.session) {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ email: normalized, payload, settings, owner, adopt }))
      return { confirmEmail: true }
    }
    const b = must(await sb.rpc('create_business', { p: payload }))
    const biz = bizFromRow(b, normalized)
    if (adopt && pos.hasUnclaimedData) pos.adoptIntoBusiness(biz, settings, owner)
    else pos.startBusiness(biz, settings, owner)
    email.value = normalized
    await connect(res.data.session)
    return { confirmEmail: false }
  }

  async function signIn(mail, password) {
    if (!sb) throw new Error('The server is not connected yet.')
    error.value = ''
    const res = await sb.auth.signInWithPassword({ email: mail.trim().toLowerCase(), password })
    if (res.error) throw new Error(friendlyError(res.error))
    await connect(res.data.session)
  }
  /**
   * A team member signs in from any browser with the shop code, their username and PIN.
   * The server checks the PIN; this browser then syncs the shop like a linked device.
   * Returns the local staff profile that was signed in.
   */
  async function staffSignIn(code, username, pin) {
    if (!sb) throw new Error('The server is not connected yet.')
    error.value = ''
    let session = (await sb.auth.getSession()).data.session
    if (!session) {
      const res = await sb.auth.signInAnonymously()
      if (res.error) {
        throw new Error(/anonymous/i.test(res.error.message || '')
          ? 'Staff sign-in from the web isn’t switched on for this server yet. Ask the business owner.'
          : friendlyError(res.error))
      }
      session = res.data.session
    }
    const r = must(await sb.rpc('staff_sign_in', { p_code: code, p_username: username, p_pin: pin }))
    if (!r?.ok) throw new Error(r?.message || 'That username and PIN don’t match.')
    localStorage.setItem(WEB_SESSION_KEY, '1')
    await connect(session)
    const user = pos.staff.find((s) => s.id === r.staff_id && s.active)
    if (!user) throw new Error('Your profile could not be loaded. Try again.')
    pos.session = { userId: user.id, at: Date.now() }
    return user
  }
  const isWebSession = () => localStorage.getItem(WEB_SESSION_KEY) === '1'
  /** Lock / sign out: a browser that a team member signed in with the shop code is signed out of the shop too. */
  async function endWorkerSession() {
    pos.logout()
    if (isWebSession()) await signOutBusiness()
  }

  async function resetPassword(mail) {
    if (!sb) throw new Error('The server is not connected yet.')
    const res = await sb.auth.resetPasswordForEmail(mail.trim().toLowerCase(), { redirectTo: location.origin + '/' })
    if (res.error) throw new Error(friendlyError(res.error))
  }
  /** Sets the new password after the owner opened a reset link (see `recovering`). */
  async function updatePassword(password) {
    if (!sb) throw new Error('The server is not connected yet.')
    if ((password || '').length < 8) throw new Error('Use a password with at least 8 characters.')
    const res = await sb.auth.updateUser({ password })
    if (res.error) throw new Error(friendlyError(res.error))
    recovering.value = false
    if (!pos.signedIn) {
      const { data } = await sb.auth.getSession()
      if (data.session) await connect(data.session)
    }
  }
  /** Signs this device out of the business. Unsynced changes are pushed first when possible. */
  async function signOutBusiness() {
    if (active) {
      try {
        for (const c of COLLECTIONS) await flushCollection(c)
        await flushSettings()
      } catch {
        // offline: the cloud keeps the last synced copy
      }
    }
    try {
      if (sb) await sb.auth.signOut()
    } catch {
      // already signed out
    }
    stop('signed-out')
    localStorage.removeItem(HASH_KEY)
    localStorage.removeItem(WEB_SESSION_KEY)
    bid = null
    pos.leaveBusiness()
  }
  async function saveProject(url, key) {
    if (!/^https:\/\/.+/.test(url.trim())) throw new Error('The project URL should start with https://')
    if (!key.trim()) throw new Error('Paste the anon / publishable key')
    stop('disabled')
    saveConfig({ url, key })
    await init()
  }
  async function syncNow() {
    if (!sb || !bid) return
    status.value = 'syncing'
    try {
      await reconcile()
      if (!active && !pos.suspended) {
        active = true
        startWatchers()
      }
      markSynced()
    } catch (e) {
      fail(e)
      throw e
    }
  }

  window.addEventListener('online', () => active && flushAllSoon())

  return {
    status, error, email, lastSyncedAt, configured, fromEnv, projectUrl, platform, online, recovering,
    init, signIn, staffSignIn, endWorkerSession, signUpBusiness, resetPassword, updatePassword, signOutBusiness, saveProject, syncNow, loadPlatform,
  }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAdminClient, getConfig, saveConfig, friendlyError } from '@/lib/supabase'

// Platform-admin data access for /admin2026. Every call runs as the admin's own login and is
// checked on the server by is_platform_admin(); nothing here bypasses row level security.
export const useAdmin = defineStore('admin', () => {
  const ready = ref(false)
  const configured = ref(!!getConfig())
  const session = ref(null)
  const isAdmin = ref(false)
  let sb = null

  const q = async (promise) => {
    const { data, error } = await promise
    if (error) throw new Error(friendlyError(error))
    return data
  }

  async function checkAdmin() {
    isAdmin.value = !!(await q(sb.rpc('is_platform_admin')))
  }

  async function init() {
    configured.value = !!getConfig()
    if (!configured.value) {
      ready.value = true
      return
    }
    sb = getAdminClient()
    try {
      const { data } = await sb.auth.getSession()
      session.value = data.session
      if (session.value) await checkAdmin()
    } catch {
      isAdmin.value = false
    }
    ready.value = true
  }

  async function signIn(email, password) {
    const r = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (r.error) throw new Error(friendlyError(r.error))
    session.value = r.data.session
    await checkAdmin()
    if (!isAdmin.value) {
      await sb.auth.signOut()
      session.value = null
      throw new Error('This account is not a platform admin.')
    }
  }
  async function signOut() {
    try {
      await sb?.auth.signOut()
    } finally {
      session.value = null
      isAdmin.value = false
    }
  }
  async function saveProject(url, key) {
    if (!/^https:\/\/.+/.test(url.trim())) throw new Error('The project URL should start with https://')
    if (!key.trim()) throw new Error('Paste the anon / publishable key')
    saveConfig({ url, key })
    ready.value = false
    await init()
  }

  // ---- businesses ----
  const overview = () => q(sb.rpc('admin_overview'))
  const updateBusiness = (id, patch) => q(sb.from('businesses').update(patch).eq('id', id).select().single())
  const deleteBusiness = (id) => q(sb.from('businesses').delete().eq('id', id))

  // ---- any shop table ----
  async function rows(table, bid, orderBy = 'created_at') {
    const out = []
    for (let from = 0; ; from += 1000) {
      const data = await q(sb.from(table).select('*').eq('business_id', bid).order(orderBy, { ascending: false }).range(from, from + 999))
      out.push(...data)
      if (data.length < 1000) break
    }
    return out
  }
  const saveRow = (table, row) => q(sb.from(table).upsert(row).select().single())
  const deleteRow = (table, id, bid) => q(sb.from(table).delete().eq('id', id).eq('business_id', bid))
  async function getSettings(bid) {
    const r = await q(sb.from('business_settings').select('data').eq('business_id', bid).maybeSingle())
    return r?.data || {}
  }
  const saveSettings = (bid, data) => q(sb.from('business_settings').upsert({ business_id: bid, data }))

  // ---- platform ----
  const getPlatform = () => q(sb.from('platform_settings').select('*').eq('id', 'main').single())
  const savePlatform = (patch) => q(sb.from('platform_settings').update(patch).eq('id', 'main').select().single())
  const listAdmins = () => q(sb.rpc('admin_list_admins'))
  const addAdmin = (email) => q(sb.rpc('admin_add_admin', { target_email: email }))
  const removeAdmin = (id) => q(sb.rpc('admin_remove_admin', { target: id }))

  return {
    ready, configured, session, isAdmin,
    init, signIn, signOut, saveProject,
    overview, updateBusiness, deleteBusiness,
    rows, saveRow, deleteRow, getSettings, saveSettings,
    getPlatform, savePlatform, listAdmins, addAdmin, removeAdmin,
  }
})

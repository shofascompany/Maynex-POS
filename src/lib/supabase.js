import { createClient } from '@supabase/supabase-js'

// Storage keys keep their original prefix so existing devices stay connected.
const CONFIG_KEY = 'tillo:supabase'

/** Server details: from .env (normal), or saved on this device from the platform admin page. */
export function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (url && key && !url.includes('your-project-ref')) return { url, key, fromEnv: true }
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null')
    if (saved?.url && saved?.key) return { ...saved, fromEnv: false }
  } catch {
    // ignore unreadable storage
  }
  return null
}

export function saveConfig(config) {
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: config.url.trim(), key: config.key.trim() }))
  else localStorage.removeItem(CONFIG_KEY)
}

const clients = {}

function make(kind, storageKey) {
  const config = getConfig()
  if (!config) return null
  const signature = config.url + config.key
  const c = clients[kind]
  if (!c || c.signature !== signature) {
    clients[kind] = {
      signature,
      client: createClient(config.url, config.key, {
        // PKCE puts email-link results in ?code=… (not #…), which leaves the app's #-routes alone
        auth: { persistSession: true, autoRefreshToken: true, storageKey, detectSessionInUrl: kind === 'shop', flowType: 'pkce' },
      }),
    }
  }
  return clients[kind].client
}

/** The shop's own login (one per business, shared by its devices). */
export const getClient = () => make('shop', 'tillo-auth')

/** The platform admin login used on /admin2026, kept separate so it never signs a shop's till out. */
export const getAdminClient = () => make('admin', 'maynex-admin-auth')

/** Turns Supabase/PostgREST errors into a sentence a shop owner can act on. */
export function friendlyError(e) {
  const msg = e?.message || String(e || '')
  if (/Invalid login credentials/i.test(msg)) return 'That email and password don’t match an account.'
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for the link.'
  if (/User already registered/i.test(msg)) return 'An account with this email already exists. Sign in instead.'
  if (/Password should be at least/i.test(msg)) return 'Use a password with at least 8 characters.'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the server. Check your internet connection.'
  if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a minute and try again.'
  return msg || 'Something went wrong. Please try again.'
}

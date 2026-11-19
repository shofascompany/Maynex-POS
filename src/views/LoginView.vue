<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { UserRound, KeyRound, ArrowRight, Eye, EyeOff, Store, Info, ArrowLeft, MailCheck, Mail } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useSync } from '@/stores/sync'
import { toast } from '@/composables'
import AuthShell from '@/components/AuthShell.vue'

const pos = usePos()
const sync = useSync()
const router = useRouter()
const route = useRoute()

const mode = ref('login') // login | forgot | sent
const who = ref('')
const secret = ref('')
const show = ref(false)
const busy = ref(false)
const shake = ref(false)

const isEmail = computed(() => who.value.includes('@'))
// staff on a browser that isn't linked to a shop also give the shop code (from their manager, or a ?shop= link)
const SHOP_KEY = 'maynex:last-shop'
const shopCode = ref(String(route.query.shop || localStorage.getItem(SHOP_KEY) || '').toUpperCase())
const needCode = computed(() => !pos.signedIn && !!who.value && !isEmail.value)
const secretLabel = computed(() => (who.value ? (isEmail.value ? 'Password' : 'PIN') : 'Password or PIN'))

// wrong-PIN lockout, kept per device: 5 tries, then a pause that doubles each time
const LOCK_KEY = 'maynex:pin-lock'
const lock = ref(readLock())
const now = ref(Date.now())
let tick
function readLock() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null') || { fails: 0, until: 0, level: 0 }
  } catch {
    return { fails: 0, until: 0, level: 0 }
  }
}
function writeLock() {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(lock.value))
  } catch {
    // storage unavailable: the lock simply resets on reload
  }
}
const lockedFor = computed(() => Math.max(0, Math.ceil((lock.value.until - now.value) / 1000)))
function failPin() {
  lock.value.fails++
  if (lock.value.fails >= 5) {
    lock.value.level++
    lock.value.until = Date.now() + 30000 * 2 ** (lock.value.level - 1)
    lock.value.fails = 0
  }
  writeLock()
}
onMounted(() => (tick = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => clearInterval(tick))

function bounce(msg) {
  shake.value = true
  setTimeout(() => (shake.value = false), 500)
  toast(msg, 'warning', 3500)
}

function go(user) {
  toast(`Welcome, ${user.name.split(' ')[0]}`)
  router.replace(route.query.redirect || '/')
}

async function submit() {
  if (!who.value.trim() || !secret.value) return bounce('Enter your email or username, and your password or PIN')
  if (isEmail.value) {
    if (!sync.configured) return bounce('The server isn’t connected yet. Staff can still sign in with username and PIN.')
    busy.value = true
    try {
      await sync.signIn(who.value, secret.value)
      if (pos.suspended) return router.replace({ name: 'suspended' })
      if (pos.needsSetup) return router.replace({ name: 'setup' })
      const user = pos.loginOwner()
      if (user) go(user)
      else router.replace({ name: 'setup' })
    } catch (e) {
      bounce(e.message)
    } finally {
      busy.value = false
    }
    return
  }
  if (!/^\d{4}$/.test(secret.value)) return bounce('Staff PINs are 4 digits')
  // staff on a browser not linked to a shop: shop code + username + PIN, checked by the server
  if (!pos.signedIn) {
    const code = shopCode.value.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(code)) return bounce('Enter the 6-character shop code from your manager')
    if (!sync.configured) return bounce('The server isn’t connected yet.')
    busy.value = true
    try {
      const user = await sync.staffSignIn(code, who.value.trim(), secret.value)
      localStorage.setItem(SHOP_KEY, code)
      if (pos.suspended) return router.replace({ name: 'suspended' })
      go(user)
    } catch (e) {
      secret.value = ''
      bounce(e.message)
    } finally {
      busy.value = false
    }
    return
  }
  // staff: username + PIN, checked on this device
  if (lockedFor.value) return bounce(`Too many wrong PINs. Try again in ${lockedFor.value}s.`)
  const user = pos.login(secret.value, who.value)
  if (!user) {
    failPin()
    secret.value = ''
    return bounce(lockedFor.value ? `Too many wrong PINs. Try again in ${lockedFor.value}s.` : 'That username and PIN don’t match')
  }
  lock.value = { fails: 0, until: 0, level: 0 }
  writeLock()
  go(user)
}

async function forgot() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(who.value.trim())) return bounce('Enter the owner email you signed up with')
  busy.value = true
  try {
    await sync.resetPassword(who.value)
    mode.value = 'sent'
  } catch (e) {
    bounce(e.message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthShell
    :title="mode === 'login' ? (pos.signedIn ? `Sign in to ${pos.business.name}` : 'Sign in') : mode === 'forgot' ? 'Reset the owner password' : 'Check your email'"
    :subtitle="mode === 'login' ? (pos.signedIn ? 'Owners use their email and password. Staff use their username and PIN.' : 'Welcome back to Maynex POS.') : mode === 'forgot' ? 'We’ll email a link to choose a new password.' : ''"
  >
    <form v-if="mode === 'login'" class="stack" :class="{ shake }" @submit.prevent="submit">
      <div v-if="pos.signedIn" class="linked"><Store :size="15" /> This device is linked to <b>{{ pos.business.name }}</b></div>
      <div v-else class="linked off"><Info :size="15" /> Staff: sign in with your shop code, username and PIN. Owners use email and password.</div>

      <label class="field"><span class="label">Email or username</span>
        <div class="input-icon"><component :is="isEmail ? Mail : UserRound" :size="16" />
          <input v-model="who" class="input input-lg" autocomplete="username" autocapitalize="none" spellcheck="false" autofocus />
        </div>
      </label>
      <Transition name="fade">
        <label v-if="needCode" class="field"><span class="label">Shop code</span>
          <div class="input-icon"><Store :size="16" />
            <input v-model="shopCode" class="input input-lg code" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. K7MX4Q" @input="shopCode = shopCode.toUpperCase()" />
          </div>
        </label>
      </Transition>
      <label class="field">
        <span class="label row between">{{ secretLabel }}
          <button v-if="isEmail || !who" type="button" class="link" @click="mode = 'forgot'">Forgot password?</button>
        </span>
        <div class="input-icon pw"><KeyRound :size="16" />
          <input v-model="secret" class="input input-lg" :class="{ mono: !isEmail && who }" :type="show ? 'text' : 'password'"
                 :inputmode="who && !isEmail ? 'numeric' : 'text'" :autocomplete="isEmail ? 'current-password' : 'off'" />
          <button type="button" class="icon-btn xs eye" :aria-label="show ? 'Hide' : 'Show'" @click="show = !show"><EyeOff v-if="show" :size="13" /><Eye v-else :size="13" /></button>
        </div>
      </label>
      <p v-if="lockedFor && !isEmail" class="locked">Too many wrong PINs on this device. Try again in {{ lockedFor }}s.</p>
      <button class="btn btn-primary btn-lg btn-block" type="submit" :disabled="busy">
        <span v-if="busy" class="spinner"></span>{{ busy ? 'Signing in…' : 'Sign in' }}<ArrowRight v-if="!busy" :size="17" />
      </button>
      <p class="muted small tip">Staff: your manager can give you the shop code, your username and PIN.</p>
    </form>

    <form v-else-if="mode === 'forgot'" class="stack" @submit.prevent="forgot">
      <label class="field"><span class="label">Owner email</span>
        <div class="input-icon"><Mail :size="16" /><input v-model="who" class="input input-lg" type="email" autocomplete="email" autofocus /></div>
      </label>
      <button class="btn btn-primary btn-lg btn-block" type="submit" :disabled="busy">{{ busy ? 'Sending…' : 'Send reset link' }}</button>
      <button class="btn btn-ghost" type="button" @click="mode = 'login'"><ArrowLeft :size="16" /> Back to sign in</button>
    </form>

    <div v-else class="sent">
      <span class="sent-ico"><MailCheck :size="30" /></span>
      <p>If <b>{{ who.trim() }}</b> has an account, a reset link is on its way. Open it on this device to choose a new password.</p>
      <button class="btn btn-lg btn-block" @click="mode = 'login'"><ArrowLeft :size="16" /> Back to sign in</button>
    </div>

    <template #foot>
      <template v-if="!pos.signedIn">New business? <RouterLink to="/signup">Create your business</RouterLink></template>
      <template v-else><RouterLink to="/welcome">About Maynex POS</RouterLink></template>
    </template>
  </AuthShell>
</template>

<style scoped>
.linked { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; font-size: 13px; color: var(--text-2); background: color-mix(in srgb, var(--success) 8%, var(--bg-2)); border: 1px solid color-mix(in srgb, var(--success) 25%, transparent); }
.linked svg { color: var(--success); flex-shrink: 0; }
.linked.off { background: var(--surface-2); border-color: var(--border); }
.linked.off svg { color: var(--accent-ink); }
.between { justify-content: space-between; width: 100%; }
.link { background: none; border: 0; padding: 0; font: 650 12.5px var(--font); color: var(--accent-ink); cursor: pointer; }
.pw { position: relative; }
.pw .input { padding-right: 42px; }
.mono { font-family: var(--mono); letter-spacing: .3em; }
.code { font-family: var(--mono); letter-spacing: .25em; text-transform: uppercase; }
.eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); }
.locked { font-size: 13px; font-weight: 650; color: var(--danger); }
.tip { text-align: center; }
.shake { animation: shake .45s; }
.spinner { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .35); border-top-color: #fff; animation: spin .7s linear infinite; }
.sent { display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
.sent p { color: var(--text-2); line-height: 1.6; }
.sent-ico { width: 68px; height: 68px; border-radius: 22px; display: grid; place-items: center; color: #fff; background: var(--grad); box-shadow: 0 18px 34px -16px var(--c1); }
</style>

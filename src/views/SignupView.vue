<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Store, UserRound, ArrowRight, ArrowLeft, Check, Eye, EyeOff, KeyRound, Mail, Lock, MailCheck } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useSync } from '@/stores/sync'
import { CURRENCIES, BUSINESS_TYPES } from '@/utils/constants'
import { formatMoney } from '@/utils/format'
import { toast } from '@/composables'
import AuthShell from '@/components/AuthShell.vue'
import ServerNotice from '@/components/ServerNotice.vue'

const pos = usePos()
const sync = useSync()
const router = useRouter()

const step = ref(1)
const busy = ref(false)
const sentTo = ref('')
const showPw = ref(false)

const biz = ref({ name: '', type: '', country: '', city: '', phone: '', currency: guessCurrency(), taxRate: 0, taxInclusive: false })
const owner = ref({ name: '', email: '', password: '', pin: '', pin2: '', adopt: true })

function guessCurrency() {
  try {
    const region = (new Intl.NumberFormat().resolvedOptions().locale.split('-')[1] || '').toUpperCase()
    const map = { US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', KE: 'KES', UG: 'UGX', TZ: 'TZS', RW: 'RWF', NG: 'NGN', GH: 'GHS', ZA: 'ZAR', IN: 'INR', AE: 'AED', JP: 'JPY' }
    return map[region] || 'USD'
  } catch {
    return 'USD'
  }
}

const emailOk = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(owner.value.email.trim()))
const pwScore = computed(() => {
  const p = owner.value.password
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(4, s)
})
const pwLabel = computed(() => ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][owner.value.password.length < 8 ? 0 : pwScore.value])
const step1Ok = computed(() => biz.value.name.trim() && biz.value.type && biz.value.country.trim() && biz.value.city.trim() && biz.value.phone.trim() && Number(biz.value.taxRate) >= 0 && Number(biz.value.taxRate) <= 100)
const step2Ok = computed(() => owner.value.name.trim() && emailOk.value && owner.value.password.length >= 8 && /^\d{4}$/.test(owner.value.pin) && owner.value.pin === owner.value.pin2)
const signupsClosed = computed(() => sync.configured && !sync.platform.allowSignups)

function next() {
  if (!step1Ok.value) return toast('Fill in all the business details marked *', 'warning')
  step.value = 2
}
const digits = (k) => (owner.value[k] = owner.value[k].replace(/\D/g, '').slice(0, 4))

async function submit() {
  if (!step2Ok.value) return toast('Check your details: a valid email, a password of 8+ characters and matching 4-digit PINs', 'warning')
  busy.value = true
  try {
    const b = biz.value
    const settings = {
      storeName: b.name.trim(), phone: b.phone.trim(), address: [b.city.trim(), b.country.trim()].filter(Boolean).join(', '),
      email: owner.value.email.trim().toLowerCase(), currency: b.currency, taxRate: Number(b.taxRate) || 0, taxInclusive: b.taxInclusive,
    }
    const r = await sync.signUpBusiness({
      email: owner.value.email, password: owner.value.password,
      business: { name: b.name.trim(), business_type: b.type, country: b.country.trim(), city: b.city.trim(), currency: b.currency, phone: b.phone.trim() },
      settings, owner: { name: owner.value.name.trim(), pin: owner.value.pin }, adopt: owner.value.adopt,
    })
    if (r.confirmEmail) {
      sentTo.value = owner.value.email.trim()
      return
    }
    toast(`Welcome to Maynex POS, ${owner.value.name.trim().split(' ')[0]}. ${b.name.trim()} is ready.`)
    router.replace('/')
  } catch (e) {
    toast(e.message, 'error', 5000)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthShell
    :title="sentTo ? 'Check your email' : step === 1 ? 'Create your business' : 'Your owner account'"
    :subtitle="sentTo ? '' : step === 1 ? 'Tell us about the business. Only what’s needed to run your till and receipts.' : 'You’ll use this email and password to sign each of your devices in, and your PIN to unlock the till.'"
    wide
  >
    <ServerNotice v-if="!sync.configured" />
    <div v-else-if="signupsClosed" class="closed">New businesses can’t sign up right now. Please try again later.</div>

    <div v-else-if="sentTo" class="sent">
      <span class="sent-ico"><MailCheck :size="30" /></span>
      <p>We sent a confirmation link to <b>{{ sentTo }}</b>. Open it on this device, then sign in. Your business will be created on your first sign-in.</p>
      <RouterLink to="/signin" class="btn btn-primary btn-lg btn-block">Go to sign in <ArrowRight :size="17" /></RouterLink>
    </div>

    <template v-else>
      <ol class="steps" aria-label="Sign-up progress">
        <li :class="{ on: step >= 1, done: step > 1 }"><span><Check v-if="step > 1" :size="13" /><template v-else>1</template></span> Business</li>
        <li :class="{ on: step >= 2 }"><span>2</span> Owner account</li>
      </ol>

      <Transition name="swap" mode="out-in">
        <form v-if="step === 1" key="s1" class="stack" @submit.prevent="next">
          <label class="field"><span class="label">Business name *</span>
            <div class="input-icon"><Store :size="16" /><input v-model="biz.name" class="input input-lg" maxlength="80" autocomplete="organization" autofocus /></div>
          </label>
          <div class="two">
            <label class="field"><span class="label">Type of business *</span>
              <select v-model="biz.type" class="select"><option value="" disabled>Choose…</option><option v-for="t in BUSINESS_TYPES" :key="t" :value="t">{{ t }}</option></select>
            </label>
            <label class="field"><span class="label">Business phone *</span><input v-model="biz.phone" class="input" type="tel" autocomplete="tel" /></label>
          </div>
          <div class="two">
            <label class="field"><span class="label">Country *</span><input v-model="biz.country" class="input" autocomplete="country-name" /></label>
            <label class="field"><span class="label">City / town *</span><input v-model="biz.city" class="input" autocomplete="address-level2" /></label>
          </div>
          <div class="two">
            <label class="field"><span class="label">Currency *</span>
              <select v-model="biz.currency" class="select"><option v-for="c in CURRENCIES" :key="c[0]" :value="c[0]">{{ c[0] }} · {{ c[1] }}</option></select>
              <span class="hint">Prices show as {{ formatMoney(1234.5, biz.currency) }}</span>
            </label>
            <label class="field"><span class="label">Sales tax (%)</span><input v-model.number="biz.taxRate" class="input" type="number" min="0" max="100" step="0.01" /></label>
          </div>
          <label class="switch"><input v-model="biz.taxInclusive" type="checkbox" /><span class="track"></span><span>My prices already include tax</span></label>
          <button class="btn btn-primary btn-lg btn-block" type="submit" :disabled="!step1Ok">Continue <ArrowRight :size="17" /></button>
        </form>

        <form v-else key="s2" class="stack" @submit.prevent="submit">
          <label class="field"><span class="label">Your full name *</span>
            <div class="input-icon"><UserRound :size="16" /><input v-model="owner.name" class="input input-lg" maxlength="60" autocomplete="name" autofocus /></div>
          </label>
          <label class="field"><span class="label">Email *</span>
            <div class="input-icon"><Mail :size="16" /><input v-model="owner.email" class="input" type="email" autocomplete="email" /></div>
          </label>
          <label class="field"><span class="label">Password *</span>
            <div class="input-icon pw"><Lock :size="16" /><input v-model="owner.password" class="input" :type="showPw ? 'text' : 'password'" autocomplete="new-password" minlength="8" />
              <button type="button" class="icon-btn xs eye" :aria-label="showPw ? 'Hide password' : 'Show password'" @click="showPw = !showPw"><EyeOff v-if="showPw" :size="13" /><Eye v-else :size="13" /></button>
            </div>
            <div v-if="owner.password" class="meter" :data-s="owner.password.length < 8 ? 0 : pwScore"><i></i><i></i><i></i><i></i><span>{{ pwLabel }}</span></div>
          </label>
          <div class="two">
            <label class="field"><span class="label">Till PIN (4 digits) *</span>
              <div class="input-icon"><KeyRound :size="16" /><input v-model="owner.pin" class="input mono" type="password" inputmode="numeric" maxlength="4" autocomplete="off" @input="digits('pin')" /></div>
            </label>
            <label class="field"><span class="label">Repeat PIN *</span>
              <div class="input-icon"><KeyRound :size="16" /><input v-model="owner.pin2" class="input mono" type="password" inputmode="numeric" maxlength="4" autocomplete="off" @input="digits('pin2')" /></div>
              <span v-if="owner.pin2.length === 4 && owner.pin !== owner.pin2" class="hint c-danger">PINs don’t match</span>
            </label>
          </div>
          <label v-if="pos.hasUnclaimedData" class="switch adopt"><input v-model="owner.adopt" type="checkbox" /><span class="track"></span>
            <span>Bring the products, customers and sales already on this device into this business</span></label>
          <p class="muted small">You’ll be the business <b>Manager</b>. Add supervisors, cashiers, procurement, accountants and customer service staff from <b>Team</b>.</p>
          <div class="row actions">
            <button class="btn btn-lg" type="button" @click="step = 1"><ArrowLeft :size="17" /> Back</button>
            <button class="btn btn-primary btn-lg grow" type="submit" :disabled="!step2Ok || busy">
              <span v-if="busy" class="spinner"></span><Check v-else :size="17" /> {{ busy ? 'Creating your business…' : 'Create business' }}
            </button>
          </div>
        </form>
      </Transition>
    </template>

    <template #foot>Already have a business? <RouterLink to="/signin">Sign in</RouterLink></template>
  </AuthShell>
</template>

<style scoped>
.steps { list-style: none; display: flex; gap: 8px; padding: 0; margin: 0 0 22px; }
.steps li { flex: 1; display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 12px; background: var(--surface-2); color: var(--muted); font-size: 13px; font-weight: 700; transition: all .3s var(--ease); }
.steps li span { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: var(--surface-3); }
.steps li.on { color: var(--accent-ink); background: color-mix(in srgb, var(--c1) 10%, transparent); }
.steps li.on span { background: var(--grad); color: #fff; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pw { position: relative; }
.pw .input { padding-right: 42px; }
.eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); }
.meter { display: grid; grid-template-columns: repeat(4, 1fr) auto; gap: 5px; align-items: center; margin-top: 8px; }
.meter i { height: 5px; border-radius: 99px; background: var(--surface-3); transition: background .3s; }
.meter span { font-size: 11.5px; font-weight: 700; color: var(--muted); margin-left: 6px; }
.meter[data-s='1'] i:nth-child(-n+1) { background: var(--danger); }
.meter[data-s='2'] i:nth-child(-n+2) { background: var(--warning); }
.meter[data-s='3'] i:nth-child(-n+3) { background: var(--info); }
.meter[data-s='4'] i:nth-child(-n+4) { background: var(--success); }
.adopt { align-items: flex-start; padding: 12px 14px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); }
.actions { gap: 10px; }
.spinner { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .35); border-top-color: #fff; animation: spin .7s linear infinite; }
.closed { padding: 16px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); font-weight: 600; }
.sent { display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
.sent p { color: var(--text-2); line-height: 1.6; }
.sent-ico { width: 68px; height: 68px; border-radius: 22px; display: grid; place-items: center; color: #fff; background: var(--grad); box-shadow: 0 18px 34px -16px var(--c1); }
.swap-enter-active, .swap-leave-active { transition: all .3s var(--ease); }
.swap-enter-from { opacity: 0; transform: translateX(20px); }
.swap-leave-to { opacity: 0; transform: translateX(-20px); }
@media (max-width: 520px) {
  .two { grid-template-columns: 1fr; }
}
</style>

<script setup>
import { ShieldCheck, WifiOff, Users, ChartColumn } from '@lucide/vue'
import BrandMark from './BrandMark.vue'
import Wordmark from './Wordmark.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  wide: Boolean,
})

const points = [
  { icon: Users, title: 'A login for every role', text: 'Managers, supervisors, cashiers, procurement, accountants and customer service, each seeing only their work.' },
  { icon: ChartColumn, title: 'Know your numbers', text: 'Live sales, profit, stock and cash reconciliation for your whole business.' },
  { icon: WifiOff, title: 'Never stops selling', text: 'Keeps working without internet and syncs when you are back online.' },
  { icon: ShieldCheck, title: 'Private to your business', text: 'Your data is separated from every other business on the platform.' },
]
</script>

<template>
  <div class="auth">
    <aside class="brand-side">
      <RouterLink to="/welcome" class="brand-link"><BrandMark :size="40" /><Wordmark :size="21" /></RouterLink>
      <div class="pitch">
        <h2>Run your whole business from one simple point of sale.</h2>
        <ul>
          <li v-for="p in points" :key="p.title">
            <span class="p-ico"><component :is="p.icon" :size="17" /></span>
            <div><strong>{{ p.title }}</strong><span>{{ p.text }}</span></div>
          </li>
        </ul>
      </div>
      <p class="fine">© {{ new Date().getFullYear() }} Maynex POS</p>
    </aside>

    <main class="form-side">
      <RouterLink to="/welcome" class="brand-link mobile-only"><BrandMark :size="36" /><Wordmark :size="19" /></RouterLink>
      <div class="form-wrap" :class="{ wide }">
        <header class="head">
          <h1>{{ title }}</h1>
          <p v-if="subtitle">{{ subtitle }}</p>
        </header>
        <slot />
      </div>
      <div class="foot"><slot name="foot" /></div>
    </main>
  </div>
</template>

<style scoped>
.auth { min-height: 100%; display: grid; grid-template-columns: minmax(340px, 0.9fr) 1.1fr; background: var(--bg); }
.brand-side {
  position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 32px; padding: 40px 48px;
  color: #fff; background: var(--grad); background-size: 200% 200%; animation: gradientShift 16s ease infinite;
}
.brand-side::before, .brand-side::after { content: ''; position: absolute; border-radius: 50%; background: rgba(255, 255, 255, .1); pointer-events: none; }
.brand-side::before { width: 420px; height: 420px; right: -160px; top: -140px; }
.brand-side::after { width: 260px; height: 260px; left: -90px; bottom: -90px; }
.brand-side .brand-link { color: #fff; }
.brand-side :deep(.wm-pos) { background: none; color: rgba(255, 255, 255, .85); }
.brand-link { position: relative; display: inline-flex; align-items: center; gap: 12px; align-self: flex-start; }
.pitch { position: relative; margin: auto 0; max-width: 460px; }
.pitch h2 { font-size: clamp(26px, 2.6vw, 34px); font-weight: 800; letter-spacing: -.03em; line-height: 1.15; }
.pitch ul { list-style: none; padding: 0; margin: 30px 0 0; display: grid; gap: 18px; }
.pitch li { display: flex; gap: 14px; align-items: flex-start; }
.pitch li strong { display: block; font-size: 14.5px; }
.pitch li span { font-size: 13.5px; color: rgba(255, 255, 255, .82); line-height: 1.5; }
.p-ico { flex-shrink: 0; width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; background: rgba(255, 255, 255, .16); border: 1px solid rgba(255, 255, 255, .25); }
.fine { position: relative; font-size: 12.5px; color: rgba(255, 255, 255, .7); }

.form-side { display: flex; flex-direction: column; align-items: center; padding: 48px 24px 28px; overflow-y: auto; }
.form-wrap { width: 100%; max-width: 440px; margin: auto 0; animation: rise .6s var(--ease) both; }
.form-wrap.wide { max-width: 560px; }
.head { margin-bottom: 26px; }
.head h1 { font-size: 28px; font-weight: 800; letter-spacing: -.03em; line-height: 1.15; }
.head p { margin-top: 8px; color: var(--text-2); font-size: 14.5px; line-height: 1.55; }
.foot { margin-top: 24px; font-size: 13.5px; color: var(--muted); text-align: center; }
.foot :deep(a) { color: var(--accent-ink); font-weight: 700; }
.mobile-only { display: none; }

@media (max-width: 920px) {
  .auth { grid-template-columns: 1fr; }
  .brand-side { display: none; }
  .mobile-only { display: inline-flex; align-self: center; margin-bottom: 28px; }
  .form-side { padding-top: 32px; }
}
</style>

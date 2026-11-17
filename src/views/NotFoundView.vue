<script setup>
import { ArrowLeft, Compass } from '@lucide/vue'
</script>

<template>
  <div class="page nf">
    <div class="nf-ico"><Compass :size="38" /></div>
    <h1 class="gradient-text">404</h1>
    <h2>This aisle doesn't exist</h2>
    <p class="muted">The page you're looking for was moved, removed, or never stocked.</p>
    <RouterLink to="/" class="btn btn-primary btn-lg"><ArrowLeft :size="18" /> Back to dashboard</RouterLink>
  </div>
</template>

<style scoped>
.nf { min-height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; }
.nf-ico { width: 84px; height: 84px; border-radius: 26px; display: grid; place-items: center; color: #fff; background: var(--grad); box-shadow: 0 20px 40px -16px var(--c1); animation: floaty 4s ease-in-out infinite; }
.nf-ico svg { animation: spin 12s linear infinite; }
h1 { font-size: 110px; font-weight: 800; letter-spacing: -.06em; line-height: 1; background-size: 200% 200%; animation: gradientShift 5s ease infinite; }
h2 { font-size: 22px; font-weight: 800; }
.btn { margin-top: 14px; }
</style>

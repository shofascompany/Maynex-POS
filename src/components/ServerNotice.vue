<script setup>
import { ServerOff } from '@lucide/vue'
</script>

<template>
  <div class="server-notice">
    <span class="ico"><ServerOff :size="20" /></span>
    <div>
      <strong>Maynex POS isn’t connected to its server yet</strong>
      <p>Business accounts need the platform’s Supabase server. If you run this platform, add
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the <code>.env</code> file and restart,
        or connect it from the platform admin page.</p>
    </div>
  </div>
</template>

<style scoped>
.server-notice { display: flex; gap: 14px; padding: 16px; border-radius: 16px; background: color-mix(in srgb, var(--warning) 9%, var(--bg-2)); border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent); }
.ico { flex-shrink: 0; width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: var(--warning); background: color-mix(in srgb, var(--warning) 15%, transparent); }
strong { display: block; font-size: 14px; }
p { margin-top: 4px; font-size: 13px; color: var(--text-2); line-height: 1.55; }
code { font-family: var(--mono); font-size: 12px; padding: 1px 5px; border-radius: 5px; background: var(--surface-2); }
</style>

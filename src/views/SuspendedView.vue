<script setup>
import { useRouter } from 'vue-router'
import { PauseCircle, LogOut, RefreshCw } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useSync } from '@/stores/sync'
import { confirm, toast } from '@/composables'
import AuthShell from '@/components/AuthShell.vue'

const pos = usePos()
const sync = useSync()
const router = useRouter()

async function check() {
  await sync.init()
  if (!pos.suspended) {
    toast('Your account is active again')
    router.replace({ name: 'login' })
  } else toast('Still on hold', 'info')
}
async function leave() {
  if (!(await confirm({ title: 'Sign this device out?', message: 'The owner will need the business email and password to sign it in again.', confirmText: 'Sign out', danger: true }))) return
  await sync.signOutBusiness()
  router.replace({ name: 'login' })
}
</script>

<template>
  <AuthShell :title="`${pos.business?.name || 'This business'} is on hold`" subtitle="Selling and changes are paused for this business. Your data is safe and nothing has been deleted.">
    <div class="stack">
      <div class="hold">
        <span class="ico"><PauseCircle :size="22" /></span>
        <div>
          <strong>Reason</strong>
          <p>{{ pos.business?.suspendedReason || 'The platform administrator put this account on hold.' }}</p>
        </div>
      </div>
      <p class="muted small">This page updates on its own when the account is reactivated. Contact Maynex POS support if you think this is a mistake.</p>
      <button class="btn btn-primary btn-lg btn-block" @click="check"><RefreshCw :size="16" /> Check again</button>
      <button class="btn btn-ghost" @click="leave"><LogOut :size="16" /> Sign this device out</button>
    </div>
  </AuthShell>
</template>

<style scoped>
.hold { display: flex; gap: 14px; padding: 16px; border-radius: 16px; background: color-mix(in srgb, var(--warning) 8%, var(--bg-2)); border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent); }
.ico { flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: var(--warning); background: color-mix(in srgb, var(--warning) 15%, transparent); }
.hold p { margin-top: 3px; color: var(--text-2); font-size: 14px; }
</style>

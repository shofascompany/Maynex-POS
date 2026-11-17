<script setup>
import { TriangleAlert, CircleHelp } from '@lucide/vue'
import BaseModal from './BaseModal.vue'
import { confirmState } from '@/composables'

function answer(v) {
  confirmState.open = false
  confirmState.resolve?.(v)
  confirmState.resolve = null
}
</script>

<template>
  <BaseModal :open="confirmState.open" size="sm" @close="answer(false)">
    <div class="confirm">
      <div class="ico" :class="{ danger: confirmState.danger }">
        <TriangleAlert v-if="confirmState.danger" :size="26" />
        <CircleHelp v-else :size="26" />
      </div>
      <h3>{{ confirmState.title }}</h3>
      <p v-if="confirmState.message" class="muted">{{ confirmState.message }}</p>
      <div class="row actions">
        <button class="btn grow" @click="answer(false)">Cancel</button>
        <button class="btn grow" :class="confirmState.danger ? 'btn-danger' : 'btn-primary'" @click="answer(true)">{{ confirmState.confirmText }}</button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.confirm { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding-top: 8px; }
.ico { width: 60px; height: 60px; border-radius: 20px; display: grid; place-items: center; margin-bottom: 6px; color: var(--accent-ink); background: var(--grad-soft); animation: popIn .5s var(--spring); }
.ico.danger { color: var(--danger); background: color-mix(in srgb, var(--danger) 15%, transparent); }
h3 { font-size: 18px; font-weight: 800; }
.actions { width: 100%; margin-top: 14px; }
</style>

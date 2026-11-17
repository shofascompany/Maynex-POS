<script setup>
import { CircleCheck, TriangleAlert, CircleX, Info } from '@lucide/vue'
import { toasts, dismissToast } from '@/composables'

const icons = { success: CircleCheck, warning: TriangleAlert, error: CircleX, info: Info }
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type" @click="dismissToast(t.id)">
        <span class="ticon"><component :is="icons[t.type] || Info" :size="18" /></span>
        <span class="msg">{{ t.message }}</span>
        <span class="bar" :style="{ animationDuration: t.timeout + 'ms' }"></span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts { position: fixed; right: 20px; bottom: 20px; z-index: 400; display: flex; flex-direction: column; gap: 10px; align-items: flex-end; pointer-events: none; }
.toast {
  --tone: var(--success);
  position: relative; overflow: hidden; pointer-events: auto; cursor: pointer;
  display: flex; align-items: center; gap: 12px; min-width: 260px; max-width: 380px;
  padding: 13px 16px 15px; border-radius: 16px;
  background: var(--bg-2); border: 1px solid var(--border-2);
  box-shadow: 0 20px 40px -18px rgba(0, 0, 0, .55);
  font-weight: 600; font-size: 13.5px;
}
.toast.warning { --tone: var(--warning); }
.toast.error { --tone: var(--danger); }
.toast.info { --tone: var(--info); }
.ticon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0; color: var(--tone); background: color-mix(in srgb, var(--tone) 16%, transparent); }
.msg { flex: 1; }
.bar { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: var(--tone); transform-origin: left; animation: shrink linear forwards; opacity: .8; }
@keyframes shrink { to { transform: scaleX(0); } }

.toast-enter-active { transition: all .5s var(--spring); }
.toast-leave-active { transition: all .3s var(--ease); }
.toast-enter-from { opacity: 0; transform: translateX(60px) scale(.9); }
.toast-leave-to { opacity: 0; transform: translateX(40px); }
.toast-move { transition: transform .4s var(--ease); }
@media (max-width: 600px) {
  .toasts { left: 16px; right: 16px; align-items: stretch; }
  .toast { max-width: none; }
}
</style>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { X } from '@lucide/vue'
import { modalStack } from '@/composables'

const props = defineProps({
  open: Boolean,
  title: String,
  subtitle: String,
  size: { type: String, default: 'md' },
  persistent: Boolean,
})
const emit = defineEmits(['update:open', 'close'])
const id = Symbol('modal')

function close() {
  if (props.persistent) return
  emit('update:open', false)
  emit('close')
}
function onKey(e) {
  if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) {
    e.preventDefault()
    close()
  }
}
function release() {
  const i = modalStack.indexOf(id)
  if (i > -1) modalStack.splice(i, 1)
  window.removeEventListener('keydown', onKey)
}
watch(
  () => props.open,
  (v) => {
    if (v) {
      modalStack.push(id)
      window.addEventListener('keydown', onKey)
    } else release()
  },
  { immediate: true },
)
onBeforeUnmount(release)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="backdrop" @mousedown.self="close">
        <div class="modal" :class="size" role="dialog" aria-modal="true">
          <header v-if="title || $slots.header" class="head">
            <slot name="header">
              <div>
                <h3>{{ title }}</h3>
                <p v-if="subtitle" class="muted small">{{ subtitle }}</p>
              </div>
            </slot>
            <button v-if="!persistent" class="icon-btn sm" aria-label="Close" @click="close"><X :size="17" /></button>
          </header>
          <div class="body"><slot /></div>
          <footer v-if="$slots.footer" class="foot"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed; inset: 0; z-index: 200;
  display: grid; place-items: center; padding: 20px;
  background: rgba(4, 4, 12, .55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.modal {
  position: relative; width: 100%; max-height: calc(100dvh - 40px);
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--bg-2); border: 1px solid var(--border-2); border-radius: 24px;
  box-shadow: 0 40px 90px -30px rgba(0, 0, 0, .65);
}
.modal::before {
  content: ''; position: absolute; top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, var(--c1), var(--c3), transparent);
}
.modal::after {
  content: ''; position: absolute; top: -120px; left: 50%; width: 360px; height: 200px; transform: translateX(-50%);
  background: radial-gradient(closest-side, color-mix(in srgb, var(--c1) 18%, transparent), transparent);
  pointer-events: none;
}
.sm { max-width: 420px; }
.md { max-width: 560px; }
.lg { max-width: 820px; }
.xl { max-width: 1080px; }
.head { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 22px 22px 0; }
.head h3 { font-size: 18px; font-weight: 800; }
.body { position: relative; z-index: 1; padding: 18px 22px 22px; overflow-y: auto; }
.foot { position: relative; z-index: 1; display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; padding: 14px 22px; border-top: 1px solid var(--border); background: var(--surface); }

.modal-enter-active { transition: opacity .3s ease; }
.modal-enter-active .modal { transition: transform .55s var(--spring), opacity .3s ease; }
.modal-leave-active { transition: opacity .22s ease; }
.modal-leave-active .modal { transition: transform .22s ease, opacity .22s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal { opacity: 0; transform: translateY(28px) scale(.94); }
.modal-leave-to .modal { opacity: 0; transform: scale(.97); }

@media (max-width: 640px) {
  .backdrop { place-items: end stretch; padding: 0; }
  .modal { max-height: 92dvh; border-radius: 24px 24px 0 0; }
  .modal-enter-from .modal { transform: translateY(100%); }
  .modal-leave-to .modal { transform: translateY(60%); }
}
</style>

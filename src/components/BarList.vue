<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import ItemIcon from './ItemIcon.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  format: { type: Function, default: (v) => v },
})
const drawn = ref(false)
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
function replay() {
  drawn.value = false
  requestAnimationFrame(() => requestAnimationFrame(() => (drawn.value = true)))
}
onMounted(replay)
watch(() => props.items.map((i) => i.value).join('|'), replay)
</script>

<template>
  <ul v-if="items.length" class="barlist">
    <li v-for="(it, i) in items" :key="it.label">
      <div class="bl-row">
        <span class="bl-label">
          <span v-if="it.icon !== undefined" class="bl-icon"><ItemIcon :name="it.icon" :label="it.label" :size="15" /></span>
          <span class="ellipsis">{{ it.label }}</span>
        </span>
        <span class="num bold">{{ format(it.value) }}</span>
      </div>
      <div class="bl-track">
        <div class="bl-fill" :style="{ width: (drawn ? (it.value / max) * 100 : 0) + '%', transitionDelay: i * 70 + 'ms', background: it.color || null }"></div>
      </div>
      <div v-if="it.sub" class="muted tiny">{{ it.sub }}</div>
    </li>
  </ul>
  <div v-else class="empty small">Nothing sold in this period yet</div>
</template>

<style scoped>
.barlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.bl-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; font-size: 13px; }
.bl-label { display: flex; align-items: center; gap: 9px; min-width: 0; font-weight: 600; }
.bl-icon { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; background: var(--surface-2); color: var(--text-2); flex-shrink: 0; }
.bl-track { height: 8px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
.bl-fill { height: 100%; border-radius: inherit; background: var(--grad); transition: width 1.1s var(--ease); box-shadow: 0 0 12px -2px color-mix(in srgb, var(--c1) 70%, transparent); }
</style>

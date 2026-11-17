<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  format: { type: Function, default: (v) => Math.round(v).toLocaleString() },
  duration: { type: Number, default: 900 },
})
const current = ref(0)
const display = computed(() => props.format(current.value))
let raf

function animate(to) {
  cancelAnimationFrame(raf)
  const from = current.value
  const start = performance.now()
  const step = (now) => {
    const t = Math.min(1, (now - start) / props.duration)
    const eased = 1 - Math.pow(1 - t, 4)
    current.value = from + (to - from) * eased
    if (t < 1) raf = requestAnimationFrame(step)
    else current.value = to
  }
  raf = requestAnimationFrame(step)
}
watch(() => props.value, animate)
onMounted(() => animate(props.value))
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <span class="num">{{ display }}</span>
</template>

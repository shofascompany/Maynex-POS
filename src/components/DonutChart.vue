<script setup>
import { computed, ref, watch, onMounted } from 'vue'

const props = defineProps({
  segments: { type: Array, default: () => [] },
  format: { type: Function, default: (v) => v },
  centerLabel: { type: String, default: 'Total' },
  size: { type: Number, default: 176 },
})
const R = 50
const C = 2 * Math.PI * R
const drawn = ref(false)
const active = ref(null)

const total = computed(() => props.segments.reduce((s, x) => s + x.value, 0))
const arcs = computed(() => {
  const list = props.segments.filter((s) => s.value > 0)
  const gap = list.length > 1 ? 2.2 : 0
  let off = 0
  return list.map((s) => {
    const len = total.value ? (s.value / total.value) * C : 0
    const a = { ...s, len: Math.max(0.01, len - gap), off, pct: total.value ? (s.value / total.value) * 100 : 0 }
    off += len
    return a
  })
})
function replay() {
  drawn.value = false
  requestAnimationFrame(() => requestAnimationFrame(() => (drawn.value = true)))
}
onMounted(replay)
watch(() => props.segments.map((s) => s.value).join('|'), replay)
</script>

<template>
  <div class="donut-wrap">
    <template v-if="arcs.length">
      <div class="donut" :style="{ width: size + 'px', height: size + 'px' }">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" :r="R" class="track" />
          <circle
            v-for="(a, i) in arcs"
            :key="a.label"
            cx="60" cy="60" :r="R"
            class="seg"
            :class="{ dim: active !== null && active !== i, on: active === i }"
            :stroke="a.color"
            :stroke-dasharray="`${drawn ? a.len : 0} ${C}`"
            :stroke-dashoffset="-a.off"
            :style="{ transitionDelay: drawn ? i * 90 + 'ms' : '0ms' }"
            @mouseenter="active = i"
            @mouseleave="active = null"
          />
        </svg>
        <div class="center">
          <Transition name="fade" mode="out-in">
            <div :key="active ?? 'total'" class="center-inner">
              <strong>{{ active !== null ? format(arcs[active].value) : format(total) }}</strong>
              <span>{{ active !== null ? arcs[active].label : centerLabel }}</span>
            </div>
          </Transition>
        </div>
      </div>
      <ul class="legend">
        <li v-for="(a, i) in arcs" :key="a.label" :class="{ on: active === i }" @mouseenter="active = i" @mouseleave="active = null">
          <i :style="{ background: a.color }"></i>
          <span class="grow ellipsis">{{ a.label }}</span>
          <span class="num bold">{{ format(a.value) }}</span>
          <span class="pct num">{{ a.pct.toFixed(0) }}%</span>
        </li>
      </ul>
    </template>
    <div v-else class="empty small">No data for this period</div>
  </div>
</template>

<style scoped>
.donut-wrap { display: flex; flex-direction: column; align-items: center; gap: 18px; }
.donut { position: relative; flex-shrink: 0; }
.donut svg { width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
.track { fill: none; stroke: var(--surface-2); stroke-width: 14; }
.seg { fill: none; stroke-width: 14; cursor: pointer; transition: stroke-dasharray 1.1s var(--ease), stroke-width .3s var(--spring), opacity .3s; }
.seg.on { stroke-width: 19; filter: drop-shadow(0 0 6px rgba(0, 0, 0, .25)); }
.seg.dim { opacity: .3; }
.center { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
.center-inner { display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 64%; }
.center strong { font-size: 18px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2; }
.center span { font-size: 11.5px; color: var(--muted); }
.legend { list-style: none; margin: 0; padding: 0; width: 100%; display: flex; flex-direction: column; gap: 2px; }
.legend li { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 10px; font-size: 13px; cursor: default; transition: background .2s; }
.legend li.on, .legend li:hover { background: var(--surface-2); }
.legend i { width: 10px; height: 10px; border-radius: 4px; flex-shrink: 0; }
.pct { width: 38px; text-align: right; color: var(--muted); font-size: 12px; }
</style>

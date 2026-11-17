<script setup>
import { computed, ref, onMounted, watch } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] },
  format: { type: Function, default: (v) => v },
  height: { type: Number, default: 200 },
  labelEvery: { type: Number, default: 2 },
})
const drawn = ref(false)
const hover = ref(null)
const max = computed(() => Math.max(1, ...props.data.map((d) => d.value)))
const peak = computed(() => {
  let best = -1, idx = -1
  props.data.forEach((d, i) => { if (d.value > best) { best = d.value; idx = i } })
  return best > 0 ? idx : -1
})
function replay() {
  drawn.value = false
  requestAnimationFrame(() => requestAnimationFrame(() => (drawn.value = true)))
}
onMounted(replay)
watch(() => props.data.map((d) => d.value).join('|'), replay)
</script>

<template>
  <div class="cols" :style="{ height: height + 'px' }">
    <div
      v-for="(d, i) in data"
      :key="d.label"
      class="col"
      :class="{ peak: i === peak, on: hover === i }"
      @mouseenter="hover = i"
      @mouseleave="hover = null"
    >
      <div class="bar-area">
        <div class="bar" :style="{ height: (drawn ? Math.max(d.value ? 3 : 0, (d.value / max) * 100) : 0) + '%', transitionDelay: i * 28 + 'ms' }">
          <Transition name="pop">
            <span v-if="hover === i" class="tip">
              <strong>{{ format(d.value) }}</strong>
              <span>{{ d.label }}<template v-if="d.sub"> · {{ d.sub }}</template></span>
            </span>
          </Transition>
        </div>
      </div>
      <span class="lbl" :class="{ hidden: i % labelEvery !== 0 }">{{ d.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.cols { display: flex; align-items: stretch; gap: 6px; }
.col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; cursor: default; }
.bar-area { flex: 1; display: flex; align-items: flex-end; border-radius: 10px; background: linear-gradient(to top, var(--surface-2), transparent); }
.bar {
  position: relative; width: 100%; border-radius: 9px 9px 5px 5px;
  background: linear-gradient(to top, color-mix(in srgb, var(--c1) 55%, transparent), color-mix(in srgb, var(--c3) 75%, transparent));
  opacity: .62; transition: height 1s var(--ease), opacity .25s, filter .25s;
}
.col.peak .bar { background: var(--grad); opacity: 1; box-shadow: 0 10px 22px -10px var(--c1); }
.col.on .bar { opacity: 1; filter: brightness(1.15); }
.lbl { font-size: 10.5px; color: var(--muted); text-align: center; white-space: nowrap; overflow: hidden; }
.lbl.hidden { visibility: hidden; }
.tip {
  position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); z-index: 3; pointer-events: none;
  display: flex; flex-direction: column; align-items: center; padding: 7px 11px; border-radius: 10px; white-space: nowrap;
  background: var(--bg-2); border: 1px solid var(--border-2); box-shadow: var(--shadow); font-size: 11px; color: var(--muted);
}
.tip strong { font-size: 13.5px; color: var(--text); }
</style>

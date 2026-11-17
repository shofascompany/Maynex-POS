<script setup>
import { computed } from 'vue'
import { TrendingUp, TrendingDown } from '@lucide/vue'
import AnimatedNumber from './AnimatedNumber.vue'

const props = defineProps({
  label: String,
  value: { type: Number, default: 0 },
  format: Function,
  icon: [Object, Function],
  delta: { type: Number, default: null },
  hint: String,
  tone: { type: String, default: '#8b5cf6' },
  index: { type: Number, default: 0 },
  invert: Boolean,
})
const showDelta = computed(() => props.delta !== null && Number.isFinite(props.delta))
const good = computed(() => (props.invert ? props.delta <= 0 : props.delta >= 0))
</script>

<template>
  <div class="stat card rise" :style="{ '--i': index, '--tone': tone }">
    <div class="glow"></div>
    <div class="top">
      <span class="label">{{ label }}</span>
      <span class="ico"><component :is="icon" :size="18" /></span>
    </div>
    <div class="value"><AnimatedNumber :value="value" v-bind="format ? { format } : {}" /></div>
    <div class="foot">
      <span v-if="showDelta" class="delta" :class="good ? 'up' : 'down'">
        <TrendingUp v-if="delta >= 0" :size="13" /><TrendingDown v-else :size="13" />
        {{ Math.abs(delta).toFixed(1) }}%
      </span>
      <span class="muted small ellipsis">{{ hint }}</span>
    </div>
  </div>
</template>

<style scoped>
.stat { padding: 18px 20px; overflow: hidden; transition: transform .4s var(--ease), border-color .3s, box-shadow .4s; }
.stat:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--tone) 35%, transparent); box-shadow: 0 24px 40px -24px color-mix(in srgb, var(--tone) 60%, transparent); }
.glow {
  position: absolute; top: -60px; right: -60px; width: 170px; height: 170px; border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--tone) 40%, transparent), transparent);
  opacity: .55; transition: transform .6s var(--ease), opacity .4s; pointer-events: none;
}
.stat:hover .glow { transform: scale(1.3); opacity: .85; }
.top { position: relative; display: flex; align-items: center; justify-content: space-between; }
.label { font-size: 12.5px; font-weight: 650; color: var(--text-2); }
.ico { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; color: var(--tone); background: color-mix(in srgb, var(--tone) 16%, transparent); border: 1px solid color-mix(in srgb, var(--tone) 24%, transparent); }
.value { position: relative; margin: 10px 0 8px; font-size: 28px; font-weight: 800; letter-spacing: -.03em; line-height: 1.1; }
.foot { position: relative; display: flex; align-items: center; gap: 8px; min-height: 22px; }
.delta { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 99px; font-size: 11.5px; font-weight: 750; flex-shrink: 0; }
.delta.up { color: var(--success); background: color-mix(in srgb, var(--success) 15%, transparent); }
.delta.down { color: var(--danger); background: color-mix(in srgb, var(--danger) 15%, transparent); }
@media (max-width: 640px) {
  .stat { padding: 14px; }
  .ico { width: 30px; height: 30px; border-radius: 10px; }
  .label { font-size: 12px; }
  .value { font-size: clamp(19px, 5.6vw, 26px); margin: 8px 0 6px; overflow-wrap: anywhere; }
  .foot { flex-wrap: wrap; gap: 4px 6px; }
}
@media (hover: none) {
  .stat:hover { transform: none; }
}
</style>

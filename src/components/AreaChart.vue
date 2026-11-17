<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] },
  compare: { type: Array, default: null },
  format: { type: Function, default: (v) => v },
  axisFormat: { type: Function, default: null },
  height: { type: Number, default: 260 },
})

const W = 1000
const H = 300
const gid = 'ac' + Math.random().toString(36).slice(2, 8)
const plot = ref(null)
const hover = ref(null)

function niceMax(v) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return m * p
}
const max = computed(() => niceMax(Math.max(0, ...props.data.map((d) => d.value), ...(props.compare || []).map((d) => d.value))))

function toPts(arr) {
  const n = arr.length
  if (!n) return []
  const pts = arr.map((d, i) => [n === 1 ? W / 2 : (i / (n - 1)) * W, H - (d.value / max.value) * (H - 14)])
  return n === 1 ? [[0, pts[0][1]], [W, pts[0][1]]] : pts
}
function smooth(p) {
  if (p.length < 2) return ''
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] || p2
    const t = 0.18
    const c1x = p1[0] + (p2[0] - p0[0]) * t
    const c1y = Math.min(H, p1[1] + (p2[1] - p0[1]) * t)
    const c2x = p2[0] - (p3[0] - p1[0]) * t
    const c2y = Math.min(H, p2[1] - (p3[1] - p1[1]) * t)
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

const pts = computed(() => toPts(props.data))
const line = computed(() => smooth(pts.value))
const area = computed(() => (pts.value.length ? `${line.value} L${W},${H} L0,${H} Z` : ''))
const compareLine = computed(() => (props.compare?.length ? smooth(toPts(props.compare)) : ''))
const sig = computed(() => props.data.map((d) => d.value).join('|'))

const ticks = computed(() =>
  [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, label: (props.axisFormat || props.format)(max.value * f) })),
)
const xLabels = computed(() => {
  const n = props.data.length
  if (!n) return []
  const step = Math.max(1, Math.ceil(n / 7))
  const out = []
  for (let i = 0; i < n; i += step) out.push({ i, label: props.data[i].label, left: n === 1 ? 50 : (i / (n - 1)) * 100 })
  return out
})

function onMove(e) {
  const n = props.data.length
  if (!n || !plot.value) return
  const r = plot.value.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  hover.value = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(x * (n - 1))))
}
const hp = computed(() => {
  if (hover.value === null || !props.data[hover.value]) return null
  const n = props.data.length
  const i = hover.value
  const left = n === 1 ? 50 : (i / (n - 1)) * 100
  const top = (1 - props.data[i].value / max.value) * ((H - 14) / H) * 100 + (14 / H) * 100
  return { left, top, d: props.data[i], c: props.compare?.[i] }
})
</script>

<template>
  <div class="area-chart" :style="{ height: height + 'px' }">
    <div class="y-axis">
      <span v-for="t in ticks" :key="t.f" :style="{ bottom: t.f * 100 + '%' }">{{ t.label }}</span>
    </div>
    <div ref="plot" class="plot" @mousemove="onMove" @mouseleave="hover = null">
      <div v-for="t in ticks" :key="t.f" class="gridline" :style="{ bottom: t.f * 100 + '%' }"></div>
      <svg :key="sig" class="svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient :id="gid + 'f'" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" :y2="H">
            <stop offset="0" style="stop-color: var(--c1); stop-opacity: .42" />
            <stop offset="1" style="stop-color: var(--c3); stop-opacity: 0" />
          </linearGradient>
          <linearGradient :id="gid + 's'" gradientUnits="userSpaceOnUse" x1="0" y1="0" :x2="W" y2="0">
            <stop offset="0" style="stop-color: var(--c1)" />
            <stop offset=".55" style="stop-color: var(--c2)" />
            <stop offset="1" style="stop-color: var(--c3)" />
          </linearGradient>
        </defs>
        <path v-if="compareLine" :d="compareLine" class="cmp" vector-effect="non-scaling-stroke" />
        <path :d="area" :fill="`url(#${gid}f)`" />
        <path :d="line" :stroke="`url(#${gid}s)`" class="line" vector-effect="non-scaling-stroke" />
      </svg>
      <template v-if="hp">
        <div class="vline" :style="{ left: hp.left + '%' }"></div>
        <div class="dot" :style="{ left: hp.left + '%', top: hp.top + '%' }"></div>
        <div class="tip" :class="{ flipr: hp.left > 78, flipl: hp.left < 14 }" :style="{ left: hp.left + '%', top: hp.top + '%' }">
          <span class="muted">{{ hp.d.label }}</span>
          <strong>{{ format(hp.d.value) }}</strong>
          <span v-if="hp.d.sub" class="muted">{{ hp.d.sub }}</span>
          <span v-if="hp.c" class="muted">Prev: {{ format(hp.c.value) }}</span>
        </div>
      </template>
      <div class="x-axis">
        <span v-for="x in xLabels" :key="x.i" :style="{ left: x.left + '%' }">{{ x.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.area-chart { display: flex; gap: 12px; padding-bottom: 24px; }
.y-axis { position: relative; width: 58px; flex-shrink: 0; }
.y-axis span { position: absolute; right: 0; transform: translateY(50%); font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.plot { position: relative; flex: 1; min-width: 0; cursor: crosshair; }
.gridline { position: absolute; left: 0; right: 0; height: 1px; background: var(--border); }
.svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; animation: reveal 1.3s var(--ease) both; }
@keyframes reveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.line { fill: none; stroke-width: 2.75; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 6px 10px color-mix(in srgb, var(--c1) 45%, transparent)); }
.cmp { fill: none; stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 5 5; opacity: .55; }
.vline { position: absolute; top: 0; bottom: 0; width: 1px; background: linear-gradient(var(--c1), transparent); pointer-events: none; transition: left .15s var(--ease); }
.dot {
  position: absolute; width: 14px; height: 14px; border-radius: 50%; transform: translate(-50%, -50%);
  background: var(--bg-2); border: 3px solid var(--c1); pointer-events: none;
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--c1) 22%, transparent);
  transition: left .15s var(--ease), top .15s var(--ease);
}
.tip {
  position: absolute; transform: translate(-50%, calc(-100% - 16px)); pointer-events: none; z-index: 2;
  display: flex; flex-direction: column; gap: 1px; padding: 9px 12px; border-radius: 12px; white-space: nowrap;
  background: var(--bg-2); border: 1px solid var(--border-2); box-shadow: var(--shadow); font-size: 11.5px;
  transition: left .15s var(--ease), top .15s var(--ease);
}
.tip strong { font-size: 15px; font-weight: 800; }
.tip.flipr { transform: translate(calc(-100% - 14px), -50%); }
.tip.flipl { transform: translate(14px, -50%); }
.x-axis { position: absolute; left: 0; right: 0; bottom: -24px; height: 18px; }
.x-axis span { position: absolute; transform: translateX(-50%); font-size: 11px; color: var(--muted); white-space: nowrap; }
.x-axis span:first-child { transform: none; }
</style>

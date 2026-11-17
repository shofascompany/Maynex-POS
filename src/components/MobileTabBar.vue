<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { LayoutGrid } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { NAV } from '@/router'

/* Bottom tab bar for phones: the four screens this worker uses most, with Register in the middle, plus "More". */
const emit = defineEmits(['more'])
const props = defineProps({ moreOpen: Boolean })
const pos = usePos()
const route = useRoute()

const PRIORITY = ['register', 'dashboard', 'orders', 'products', 'customers', 'shifts', 'reports', 'staff', 'settings']
const SHORT = { shifts: 'Shifts', products: 'Stock' }

const tabs = computed(() => {
  const allowed = NAV.filter((n) => pos.can(n.perm))
  const picked = [...allowed].sort((a, b) => PRIORITY.indexOf(a.name) - PRIORITY.indexOf(b.name)).slice(0, 4)
  const ordered = allowed.filter((n) => picked.includes(n) && n.name !== 'register')
  const reg = picked.find((n) => n.name === 'register')
  if (reg) ordered.splice(Math.min(2, ordered.length), 0, reg)
  return ordered
})
const inTabs = computed(() => tabs.value.some((t) => t.name === route.name))

function badge(name) {
  if (name === 'register' && pos.cartCount) return pos.cartCount
  if (name === 'products' && pos.lowStock.length) return pos.lowStock.length
  return 0
}
function vibrate() {
  try {
    navigator.vibrate?.(8)
  } catch {
    // not supported
  }
}
</script>

<template>
  <nav class="tabbar" aria-label="Main">
    <RouterLink
      v-for="t in tabs"
      :key="t.name"
      :to="t.path"
      class="tab"
      :class="{ sell: t.name === 'register' }"
      @click="vibrate"
    >
      <span class="tab-ico">
        <component :is="t.icon" :size="t.name === 'register' ? 22 : 21" :stroke-width="2" />
        <Transition name="pop">
          <span v-if="badge(t.name)" :key="badge(t.name)" class="tab-badge" :class="{ warn: t.name === 'products' }">{{ badge(t.name) }}</span>
        </Transition>
      </span>
      <span class="tab-label">{{ t.name === 'register' ? 'Sell' : SHORT[t.name] || t.label }}</span>
    </RouterLink>
    <button class="tab" :class="{ 'router-link-active': props.moreOpen || !inTabs }" aria-label="More screens" @click="vibrate(); emit('more')">
      <span class="tab-ico"><LayoutGrid :size="21" :stroke-width="2" /></span>
      <span class="tab-label">More</span>
    </button>
  </nav>
</template>

<style scoped>
.tabbar { display: none; }

@media (max-width: 860px) {
  .tabbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
    display: flex; align-items: stretch; justify-content: space-around;
    height: var(--tabbar-space);
    padding: 0 max(6px, var(--safe-r)) var(--safe-b) max(6px, var(--safe-l));
    background: color-mix(in srgb, var(--bg-2) 82%, transparent);
    border-top: 1px solid var(--border);
    backdrop-filter: blur(22px) saturate(160%);
    -webkit-backdrop-filter: blur(22px) saturate(160%);
  }
}
:root[data-theme='light'] .tabbar { background: rgba(255, 255, 255, .9); }

.tab {
  flex: 1; min-width: 0; height: var(--tabbar-h);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  border: 0; background: none; padding: 0; cursor: pointer;
  color: var(--muted); font: 650 10.5px var(--font); letter-spacing: .01em;
  transition: color .25s;
}
.tab-ico {
  position: relative; display: grid; place-items: center;
  width: 52px; height: 30px; border-radius: 99px;
  transition: background .3s var(--ease), transform .35s var(--spring);
}
.tab-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.tab:active .tab-ico { transform: scale(.88); }
.tab.router-link-active { color: var(--text); }
.tab.router-link-active .tab-ico { background: color-mix(in srgb, var(--c1) 18%, transparent); color: var(--accent-ink); }

/* raised "Sell" button in the middle */
.tab.sell .tab-ico {
  width: 50px; height: 50px; margin-top: -22px; border-radius: 18px; color: #fff;
  background: var(--grad); background-size: 180% 180%;
  box-shadow: 0 12px 24px -10px var(--c1), 0 0 0 4px var(--bg);
}
:root[data-theme='light'] .tab.sell .tab-ico { box-shadow: 0 12px 24px -10px var(--c1), 0 0 0 4px #fff; }
.tab.sell.router-link-active .tab-ico { color: #fff; background: var(--grad); animation: gradientShift 6s ease infinite; }
.tab.sell .tab-label { margin-top: 1px; }

.tab-badge {
  position: absolute; top: -4px; right: 4px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px;
  display: grid; place-items: center; font-size: 10px; font-weight: 800; color: #fff;
  background: var(--danger); box-shadow: 0 0 0 2px var(--bg-2);
}
.tab-badge.warn { background: var(--warning); color: #241500; }
.tab.sell .tab-badge { top: -6px; right: -6px; background: var(--text); color: var(--bg); }
</style>

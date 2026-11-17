<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Menu, Sun, Moon, Lock, Bell, MonitorDown, Cloud, CloudOff, RefreshCw } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useSync } from '@/stores/sync'
import { duration } from '@/utils/format'
import { canInstall, installApp } from '@/composables/pwa'
import { toast } from '@/composables'

async function install() {
  if (await installApp()) toast('Maynex POS is installed. Open it from your home screen or app list.')
}

const emit = defineEmits(['menu'])
const pos = usePos()
const route = useRoute()
const router = useRouter()

const now = ref(Date.now())
let timer
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 10000)))
onBeforeUnmount(() => clearInterval(timer))

const dateLabel = computed(() => new Date(now.value).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }))
const timeLabel = computed(() => new Date(now.value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))
const sync = useSync()
const syncTitle = computed(() => ({
  connecting: 'Connecting to the server…', 'signed-out': 'Offline: changes are saved on this device', syncing: 'Saving changes to the server…',
  synced: 'All changes saved to the server', error: `Sync problem: ${sync.error}`, suspended: 'Business on hold',
})[sync.status] || 'Sync')
function openSync() {
  if (pos.can('settings')) router.push({ path: '/settings', hash: '#set-account' })
  else toast(syncTitle.value, sync.status === 'error' ? 'warning' : 'info')
}
const shiftLabel = computed(() => (pos.activeShift ? `Shift open · ${duration(now.value - pos.activeShift.openedAt)}` : 'No open shift'))

function toggleTheme() {
  pos.settings.theme = pos.settings.theme === 'dark' ? 'light' : 'dark'
}
function lock() {
  pos.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="topbar">
    <button class="icon-btn menu" aria-label="Open menu" @click="emit('menu')"><Menu :size="18" /></button>
    <div class="title">
      <Transition name="title" mode="out-in">
        <h2 :key="route.name">{{ route.meta.title }}</h2>
      </Transition>
      <span class="muted small hide-sm">{{ dateLabel }}</span>
    </div>
    <div class="actions">
      <Transition name="pop">
        <button v-if="canInstall" class="btn btn-soft btn-sm" title="Install Maynex POS as an app" @click="install"><MonitorDown :size="15" /><span class="hide-sm">Install app</span></button>
      </Transition>
      <RouterLink v-if="pos.can(['shifts', 'shiftsView'])" to="/shifts" class="shift-pill hide-sm" :class="{ on: pos.activeShift }">
        <span class="dot"></span>{{ shiftLabel }}
      </RouterLink>
      <RouterLink v-if="pos.can('products')" :to="{ path: '/products', query: { stock: 'low' } }" class="icon-btn" title="Low stock alerts">
        <Bell :size="17" />
        <Transition name="pop">
          <span v-if="pos.lowStock.length" class="bell-badge">{{ pos.lowStock.length }}</span>
        </Transition>
      </RouterLink>
      <button v-if="sync.configured" class="icon-btn sync" :class="sync.status" :title="syncTitle" @click="openSync">
        <RefreshCw v-if="sync.status === 'syncing' || sync.status === 'connecting'" :size="17" class="spinning" />
        <CloudOff v-else-if="sync.status === 'error' || sync.status === 'signed-out'" :size="17" />
        <Cloud v-else :size="17" />
      </button>
      <button class="icon-btn" :title="pos.settings.theme === 'dark' ? 'Light mode' : 'Dark mode'" @click="toggleTheme">
        <Transition name="spin" mode="out-in">
          <Sun v-if="pos.settings.theme === 'dark'" key="sun" :size="17" />
          <Moon v-else key="moon" :size="17" />
        </Transition>
      </button>
      <div class="clock mono hide-sm">{{ timeLabel }}</div>
      <button class="btn btn-sm" title="Lock & switch user" @click="lock"><Lock :size="15" /><span class="hide-sm">Lock</span></button>
    </div>
  </header>
</template>

<style scoped>
.topbar { display: flex; align-items: center; gap: 14px; padding: 18px 28px 14px; min-height: 76px; }
.menu { display: none; }
.title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.title h2 { font-size: 15px; font-weight: 750; color: var(--text-2); letter-spacing: 0; }
.actions { display: flex; align-items: center; gap: 10px; }
.shift-pill {
  display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px; border-radius: 99px;
  font-size: 12.5px; font-weight: 650; color: var(--text-2);
  background: var(--panel); border: 1px solid var(--border); transition: all .25s var(--ease);
}
.shift-pill:hover { border-color: var(--border-2); color: var(--text); }
.shift-pill .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); color: var(--muted); }
.shift-pill.on { color: var(--success); border-color: color-mix(in srgb, var(--success) 30%, transparent); background: color-mix(in srgb, var(--success) 9%, var(--panel)); }
.shift-pill.on .dot { background: var(--success); color: var(--success); animation: pulseRing 1.8s ease-out infinite; }
.bell-badge {
  position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px;
  display: grid; place-items: center; font-size: 10px; font-weight: 800; background: var(--warning); color: #241500;
  box-shadow: 0 0 0 2px var(--bg);
}
.sync.synced { color: var(--success); }
.sync.error { color: var(--danger); }
.sync.signed-out { color: var(--warning); }
.spinning { animation: spin 1s linear infinite; }
.clock { font-size: 13px; font-weight: 700; color: var(--text-2); padding: 0 6px; }

.title-enter-active, .title-leave-active { transition: all .3s var(--ease); }
.title-enter-from { opacity: 0; transform: translateY(8px); }
.title-leave-to { opacity: 0; transform: translateY(-8px); }
.spin-enter-active, .spin-leave-active { transition: all .35s var(--ease); }
.spin-enter-from { opacity: 0; transform: rotate(-120deg) scale(.4); }
.spin-leave-to { opacity: 0; transform: rotate(120deg) scale(.4); }

@media (max-width: 1100px) {
  .menu { display: inline-grid; }
}
@media (max-width: 860px) {
  .topbar { padding: 14px 16px 10px; min-height: 64px; }
}
</style>

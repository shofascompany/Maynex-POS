<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { LogOut, ChevronsLeft, Sun, Moon } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { NAV } from '@/router'
import { useUi } from '@/composables'
import { ROLES } from '@/utils/constants'
import { initials } from '@/utils/format'
import BrandMark from './BrandMark.vue'
import Wordmark from './Wordmark.vue'

defineProps({ open: Boolean })
const emit = defineEmits(['update:open'])
const pos = usePos()
const ui = useUi()
const router = useRouter()

const items = computed(() => NAV.filter((n) => pos.can(n.perm)))
const close = () => emit('update:open', false)

function badge(name) {
  if (name === 'register' && pos.cartCount) return { n: pos.cartCount, tone: '' }
  if (name === 'products' && pos.lowStock.length) return { n: pos.lowStock.length, tone: 'warn' }
  return null
}
function signOut() {
  pos.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="scrim" @click="close"></div>
  </Transition>
  <aside class="sidebar" :class="{ open, collapsed: ui.collapsed }">
    <div class="sheet-handle" aria-hidden="true" @click="close"></div>
    <div class="brand">
      <BrandMark :size="38" />
      <div class="brand-text fadeable">
        <Wordmark :size="19" :tagline="pos.settings.storeName || 'Point of Sale'" />
      </div>
    </div>

    <div class="nav-caption fadeable">Workspace</div>
    <nav class="nav">
      <RouterLink
        v-for="(item, i) in items"
        :key="item.name"
        :to="item.path"
        class="nav-link"
        :style="{ '--i': i }"
        :title="ui.collapsed ? item.label : undefined"
        @click="close"
      >
        <span class="nav-icon"><component :is="item.icon" :size="19" :stroke-width="2" /></span>
        <span class="nav-label fadeable">{{ item.label }}</span>
        <Transition name="pop">
          <span v-if="badge(item.name)" :key="badge(item.name).n" class="nav-badge" :class="badge(item.name).tone">{{ badge(item.name).n }}</span>
        </Transition>
      </RouterLink>
    </nav>

    <div class="side-foot">
      <button class="collapse-btn" :title="ui.collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="ui.collapsed = !ui.collapsed">
        <ChevronsLeft :size="18" />
        <span class="nav-label fadeable">Collapse</span>
      </button>
      <div v-if="pos.currentUser" class="me">
        <div class="avatar" :style="{ '--a': pos.currentUser.color }">{{ initials(pos.currentUser.name) }}</div>
        <div class="me-text fadeable">
          <strong class="ellipsis">{{ pos.currentUser.name }}</strong>
          <small>{{ ROLES[pos.currentUser.role]?.label }}</small>
        </div>
        <button class="icon-btn sm theme-toggle" :title="pos.settings.theme === 'dark' ? 'Light mode' : 'Dark mode'" @click="pos.settings.theme = pos.settings.theme === 'dark' ? 'light' : 'dark'">
          <Sun v-if="pos.settings.theme === 'dark'" :size="15" /><Moon v-else :size="15" />
        </button>
        <button class="icon-btn sm fadeable" title="Sign out" @click="signOut"><LogOut :size="15" /></button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 14px 14px;
  background: var(--panel);
  border-right: 1px solid var(--border);
  backdrop-filter: blur(22px) saturate(150%);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
  transition: width .5s var(--ease), transform .5s var(--ease);
  overflow: hidden;
  z-index: 40;
}
.brand { display: flex; align-items: center; gap: 12px; padding: 2px 6px 18px; }
.brand-text { display: flex; flex-direction: column; min-width: 0; }
.brand-text strong { font-size: 21px; font-weight: 800; letter-spacing: -.04em; line-height: 1.1; }
.brand-text small { color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nav-caption { font-size: 10.5px; text-transform: uppercase; letter-spacing: .14em; color: var(--muted); font-weight: 750; padding: 4px 12px 8px; white-space: nowrap; }

.nav { display: flex; flex-direction: column; gap: 3px; flex: 1; overflow-y: auto; overflow-x: hidden; }
.nav-link {
  position: relative; isolation: isolate;
  display: flex; align-items: center; gap: 12px;
  height: 44px; padding: 0 12px; border-radius: 13px;
  color: var(--text-2); font-weight: 620; white-space: nowrap;
  transition: color .3s, background .3s;
  animation: rise .6s var(--ease) both; animation-delay: calc(var(--i) * 40ms);
}
.nav-link::before {
  content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit;
  background: var(--grad); background-size: 200% 200%;
  opacity: 0; transform: scale(.9);
  transition: opacity .35s var(--ease), transform .5s var(--spring);
}
.nav-link:hover { color: var(--text); background: var(--surface-2); }
.nav-link.router-link-active { color: #fff; background: transparent; }
.nav-link.router-link-active::before { opacity: 1; transform: none; animation: gradientShift 6s ease infinite; box-shadow: 0 12px 26px -12px var(--c1); }
.nav-link.router-link-active .nav-icon { animation: iconPop .55s var(--spring); }
.nav-icon { display: grid; place-items: center; width: 22px; flex-shrink: 0; }
.nav-badge {
  margin-left: auto; min-width: 22px; height: 20px; padding: 0 6px; border-radius: 99px;
  display: grid; place-items: center; font-size: 11px; font-weight: 800;
  background: var(--grad); color: #fff;
}
.nav-badge.warn { background: var(--warning); color: #241500; }
.router-link-active .nav-badge { background: rgba(255, 255, 255, .25); color: #fff; }
@keyframes iconPop { 0% { transform: scale(.7) rotate(-12deg); } 100% { transform: none; } }

.side-foot { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 1px solid var(--border); }
.collapse-btn {
  display: flex; align-items: center; gap: 12px; height: 38px; padding: 0 14px; border-radius: 12px;
  background: none; border: 0; color: var(--muted); cursor: pointer; font: 600 13px var(--font); white-space: nowrap;
  transition: color .2s, background .2s;
}
.collapse-btn:hover { color: var(--text); background: var(--surface-2); }
.collapse-btn svg { transition: transform .5s var(--ease); flex-shrink: 0; }
.me { display: flex; align-items: center; gap: 10px; padding: 9px; border-radius: 15px; background: var(--surface-2); border: 1px solid var(--border); }
.me-text { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.25; }
.me-text strong { font-size: 13px; }
.me-text small { color: var(--muted); font-size: 11.5px; }
.fadeable { transition: opacity .25s ease; }
.scrim { display: none; }
.sheet-handle { display: none; }
.theme-toggle { display: none; }

/* desktop: user can collapse to an icon rail */
@media (min-width: 1101px) {
  .sidebar.collapsed { width: var(--rail-w); }
  .sidebar.collapsed .fadeable { opacity: 0; pointer-events: none; }
  .sidebar.collapsed .brand-text, .sidebar.collapsed .me-text { width: 0; }
  .sidebar.collapsed .collapse-btn svg { transform: rotate(180deg); }
  .sidebar.collapsed .nav-badge { position: absolute; top: 3px; right: 6px; min-width: 18px; height: 17px; font-size: 10px; }
  .sidebar.collapsed .me { padding: 8px; justify-content: center; }
  .sidebar.collapsed .me .icon-btn { display: none; }
}
@media (min-width: 1800px) {
  .sidebar:not(.collapsed) { width: 272px; }
}

/* tablet: always an icon rail, so the screen keeps its width */
@media (min-width: 861px) and (max-width: 1100px) {
  .sidebar { width: var(--rail-w); padding-top: calc(18px + var(--safe-t)); }
  .sidebar .fadeable { opacity: 0; pointer-events: none; }
  .sidebar .brand-text, .sidebar .me-text { width: 0; }
  .nav-caption { height: 0; padding: 0; }
  .nav-badge { position: absolute; top: 3px; right: 6px; min-width: 18px; height: 17px; font-size: 10px; }
  .collapse-btn { display: none; }
  .me { padding: 8px; justify-content: center; }
  .me .icon-btn { display: none; }
  .nav-link { justify-content: flex-start; }
}

/* phone: a sheet that slides up from the tab bar */
@media (max-width: 860px) {
  .sidebar {
    position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 80;
    width: 100%; max-height: calc(100dvh - 48px - var(--safe-t));
    padding: 8px max(16px, var(--safe-r)) calc(16px + var(--safe-b)) max(16px, var(--safe-l));
    border-right: 0; border-top: 1px solid var(--border-2); border-radius: 26px 26px 0 0;
    background: var(--bg-2); box-shadow: 0 -24px 60px -20px rgba(0, 0, 0, .5);
    overflow-y: auto; overscroll-behavior: contain;
    transform: translateY(105%); visibility: hidden;
    transition: transform .5s var(--ease), visibility 0s linear .5s;
  }
  .sidebar.open { transform: none; visibility: visible; transition: transform .5s var(--ease), visibility 0s; }
  .sheet-handle { display: block; flex-shrink: 0; width: 44px; height: 5px; margin: 2px auto 12px; border-radius: 99px; background: var(--border-2); cursor: pointer; }
  .brand { padding: 0 4px 14px; }
  .nav-caption { padding: 2px 4px 10px; }
  .nav { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; flex: none; overflow: visible; }
  .nav-link {
    flex-direction: column; justify-content: center; gap: 6px; height: auto; min-height: 84px; padding: 12px 6px;
    border-radius: 18px; background: var(--surface-2); border: 1px solid var(--border);
    font-size: 12.5px; text-align: center; white-space: normal; line-height: 1.2;
  }
  .nav-link.router-link-active { border-color: transparent; }
  .nav-icon { width: auto; }
  .nav-badge { position: absolute; top: 8px; right: 8px; margin: 0; }
  .collapse-btn { display: none; }
  .theme-toggle { display: inline-grid; }
  .side-foot { margin-top: 14px; }
  .scrim { display: block; position: fixed; inset: 0; z-index: 79; background: rgba(0, 0, 0, .5); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
}
@media (max-width: 340px) {
  .nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>

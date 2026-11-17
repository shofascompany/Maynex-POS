<script setup>
import { ref, computed, watch, watchEffect, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Megaphone, X, KeyRound } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useSync } from '@/stores/sync'
import { useUi, toast } from '@/composables'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopbar from '@/components/AppTopbar.vue'
import MobileTabBar from '@/components/MobileTabBar.vue'
import ToastStack from '@/components/ToastStack.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import BaseModal from '@/components/BaseModal.vue'

const pos = usePos()
const ui = useUi()
const route = useRoute()
const router = useRouter()
const mobileNav = ref(false)

// the phone "More" sheet closes whenever the screen changes
watch(() => route.fullPath, () => (mobileNav.value = false))

// Connects this device's business to the server (does nothing until the server is configured).
const sync = useSync()
onMounted(() => sync.init())

watchEffect(() => {
  const el = document.documentElement
  el.dataset.theme = pos.settings.theme
  el.dataset.accent = pos.settings.accent
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', pos.settings.theme === 'light' ? '#ffffff' : '#07070d')
})

// if the signed-in worker disappears (import / deactivated) send them to the lock screen
watch(
  () => pos.currentUser,
  (u) => {
    if (!u && !route.meta.public) router.replace({ name: 'login' })
  },
)
// the platform admin can suspend, reactivate or remove a business at any time
watch(
  () => pos.suspended,
  (s) => {
    if (route.meta.admin) return
    if (s) router.replace({ name: 'suspended' })
    else if (route.name === 'suspended') router.replace({ name: 'login' })
  },
)
watch(
  () => pos.signedIn,
  (s) => {
    if (!s && !route.meta.public) router.replace({ name: 'login' })
  },
)

// platform-wide notice from the admin; each notice can be dismissed once per device
const DISMISS_KEY = 'maynex:notice-dismissed'
const dismissed = ref(localStorage.getItem(DISMISS_KEY) || '')
const notice = computed(() => sync.platform.announcement?.trim())
const showNotice = computed(() => notice.value && dismissed.value !== notice.value && !route.meta.admin && !route.meta.landing)
function dismissNotice() {
  dismissed.value = notice.value
  try {
    localStorage.setItem(DISMISS_KEY, notice.value)
  } catch {
    // ignore
  }
}

// after opening a password-reset link
const newPw = ref('')
const savingPw = ref(false)
async function savePassword() {
  savingPw.value = true
  try {
    await sync.updatePassword(newPw.value)
    newPw.value = ''
    toast('Password updated')
  } catch (e) {
    toast(e.message, 'error', 5000)
  } finally {
    savingPw.value = false
  }
}
</script>

<template>
  <div class="aurora" aria-hidden="true">
    <span class="blob b1"></span>
    <span class="blob b2"></span>
    <span class="blob b3"></span>
    <div class="grain"></div>
  </div>

  <Transition name="drop">
    <div v-if="showNotice" class="notice" :class="sync.platform.tone" role="status">
      <Megaphone :size="16" />
      <span>{{ notice }}</span>
      <button class="icon-btn xs" aria-label="Dismiss notice" @click="dismissNotice"><X :size="12" /></button>
    </div>
  </Transition>

  <div v-if="route.meta.public || !pos.currentUser" class="public-shell">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>

  <div v-else class="shell" :class="{ collapsed: ui.collapsed }">
    <AppSidebar v-model:open="mobileNav" />
    <MobileTabBar :more-open="mobileNav" @more="mobileNav = !mobileNav" />
    <main class="main">
      <AppTopbar />
      <div class="content" :class="{ full: route.meta.full }">
        <RouterView v-slot="{ Component, route: r }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="r.name" />
          </Transition>
        </RouterView>
      </div>
    </main>
  </div>

  <BaseModal :open="sync.recovering" size="sm" title="Choose a new password" subtitle="For the business owner login" persistent>
    <form class="stack" @submit.prevent="savePassword">
      <label class="field"><span class="label">New password (8+ characters)</span>
        <div class="input-icon"><KeyRound :size="16" /><input v-model="newPw" class="input input-lg" type="password" autocomplete="new-password" minlength="8" autofocus /></div>
      </label>
      <button class="btn btn-primary btn-lg btn-block" type="submit" :disabled="savingPw || newPw.length < 8">{{ savingPw ? 'Saving…' : 'Save password' }}</button>
    </form>
  </BaseModal>

  <ToastStack />
  <ConfirmDialog />
</template>

<style scoped>
.notice {
  position: fixed; z-index: 90; top: calc(12px + var(--safe-t)); left: 50%; translate: -50% 0; max-width: min(720px, calc(100% - 32px));
  display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 16px; border-radius: 14px;
  font-size: 13.5px; font-weight: 600; background: var(--bg-2); border: 1px solid var(--border-2); box-shadow: var(--shadow);
}
.notice span { flex: 1; }
.notice svg { flex-shrink: 0; color: var(--info); }
.notice.success svg { color: var(--success); }
.notice.warning svg { color: var(--warning); }
.notice.danger { border-color: color-mix(in srgb, var(--danger) 40%, transparent); }
.notice.danger svg { color: var(--danger); }
.drop-enter-active, .drop-leave-active { transition: opacity .3s ease, transform .35s var(--ease); }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-12px); }
</style>

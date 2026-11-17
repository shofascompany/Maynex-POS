import { ref, computed } from 'vue'

// Captured as early as possible (this module is imported from main.js) so the
// browser's install prompt can be shown later from a button.
const deferred = ref(null)
const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export const installed = ref(standalone())
export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
export const canInstall = computed(() => !!deferred.value && !installed.value)

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred.value = e
})
window.addEventListener('appinstalled', () => {
  installed.value = true
  deferred.value = null
})

/** Shows the browser's install dialog. Resolves true if the user accepted. */
export async function installApp() {
  const e = deferred.value
  if (!e) return false
  e.prompt()
  const { outcome } = await e.userChoice
  deferred.value = null
  return outcome === 'accepted'
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Maynex POS: service worker not registered', err))
  })
}

import { ref, computed } from 'vue'

// Captured as early as possible (this module is imported from main.js) so the
// browser's install prompt can be shown later from a button.
const deferred = ref(null)
const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
  window.navigator.standalone === true

export const installed = ref(standalone())
export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const canInstall = computed(() => !!deferred.value && !installed.value)

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred.value = e
})
window.addEventListener('appinstalled', () => {
  installed.value = true
  deferred.value = null
})
window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => (installed.value = standalone()))

/** Which device and browser this is, so the install guide shows the right steps. */
export function detectDevice() {
  const ua = navigator.userAgent
  const os = isIOS ? 'ios' : /android/i.test(ua) ? 'android' : /mac/i.test(navigator.platform || ua) ? 'mac' : /win/i.test(navigator.platform || ua) ? 'windows' : /cros/i.test(ua) ? 'chromeos' : 'linux'
  const browser = /edg\//i.test(ua) ? 'edge'
    : /samsungbrowser/i.test(ua) ? 'samsung'
    : /firefox|fxios/i.test(ua) ? 'firefox'
    : /opr\//i.test(ua) ? 'opera'
    : /chrome|crios/i.test(ua) ? 'chrome'
    : /safari/i.test(ua) ? 'safari'
    : 'other'
  const desktop = ['windows', 'mac', 'linux', 'chromeos'].includes(os)
  return { os, browser, desktop }
}

/** Shows the browser's install dialog. Resolves true if the user accepted. */
export async function installApp() {
  const e = deferred.value
  if (!e) return false
  try {
    await e.prompt()
    const { outcome } = await e.userChoice
    deferred.value = null
    return outcome === 'accepted'
  } catch {
    // the browser refused the prompt (e.g. not from a click); callers fall back to the guide
    return false
  }
}

/** The one thing to do on browsers that can't install from a button (Safari, iOS, Firefox). */
function manualHint() {
  const { os, browser } = detectDevice()
  if (os === 'ios') return 'Tap Share, then “Add to Home Screen”.'
  if (browser === 'safari') return 'In Safari, choose File → Add to Dock.'
  if (browser === 'firefox') return 'Open this page in Chrome or Edge to install it.'
  if (os === 'android') return 'Open the browser menu and tap “Install app”.'
  return 'Click the install icon at the right end of the address bar.'
}

/**
 * Install straight away: on Chrome, Edge and Android the browser's own install dialog opens at once.
 * Elsewhere it returns a one-line hint for the caller to show. Resolves { installed, hint }.
 */
export async function openInstall() {
  if (installed.value) return { installed: true, hint: '' }
  if (deferred.value) {
    const ok = await installApp()
    if (ok || !deferred.value) return { installed: ok, hint: '' }
  }
  return { installed: false, hint: manualHint() }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Maynex POS: service worker not registered', err))
  })
}

import { reactive, watch } from 'vue'
import { usePos } from '@/stores/pos'
import { formatMoney, formatMoneyCompact } from '@/utils/format'
import { openInstall } from './pwa'

/* Money */
export function useMoney() {
  const pos = usePos()
  return (v) => formatMoney(v, pos.settings.currency)
}
export function useMoneyCompact() {
  const pos = usePos()
  return (v) => formatMoneyCompact(v, pos.settings.currency)
}

/* Toasts */
export const toasts = reactive([])
let toastId = 0
export function toast(message, type = 'success', timeout = 2800) {
  const id = ++toastId
  toasts.push({ id, message, type, timeout })
  setTimeout(() => dismissToast(id), timeout)
}
export function dismissToast(id) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i > -1) toasts.splice(i, 1)
}

/** Install button handler shared by every screen: direct install, or a one-line hint where that isn't possible. */
export async function installNow() {
  const r = await openInstall()
  if (r.installed) toast('Maynex POS is installed. Open it from your desktop, taskbar or home screen.')
  else if (r.hint) toast(r.hint, 'info', 6000)
}

/* Confirm dialog */
export const confirmState = reactive({ open: false, title: '', message: '', confirmText: 'Confirm', danger: false, resolve: null })
export function confirm(opts = {}) {
  return new Promise((resolve) => {
    Object.assign(confirmState, {
      title: 'Are you sure?', message: '', confirmText: 'Confirm', danger: false, ...opts, open: true, resolve,
    })
  })
}

/* Modal stack (so Esc closes only the top-most modal) */
export const modalStack = []
export const isModalOpen = () => modalStack.length > 0

/* Persisted UI preferences */
const UI_KEY = 'tillo:ui'
let saved = {}
try {
  saved = JSON.parse(localStorage.getItem(UI_KEY) || '{}')
} catch {
  saved = {}
}
const ui = reactive({ collapsed: false, ...saved })
watch(ui, (v) => {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(v))
  } catch {
    /* storage unavailable */
  }
})
export const useUi = () => ui

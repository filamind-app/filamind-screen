// App-wide toast notifications: three severities, auto-close, tap to dismiss. Replaces the old
// inline error paragraphs that shifted layouts and never went away.

import { ref } from 'vue'

export type ToastLevel = 'info' | 'warn' | 'error'

export interface Toast {
  id: number
  level: ToastLevel
  text: string
}

const AUTO_CLOSE_MS: Record<ToastLevel, number> = { info: 3000, warn: 5000, error: 7000 }

export const toasts = ref<Toast[]>([])
let seq = 0

export function toast(level: ToastLevel, text: string, opts?: { sticky?: boolean }): void {
  const id = ++seq
  // Replace an identical message instead of stacking duplicates.
  toasts.value = [...toasts.value.filter((t) => t.text !== text), { id, level, text }].slice(-3)
  // Sticky toasts (failures of destructive actions) stay until tapped - an auto-closing
  // message is too easy to miss when the user has already walked away.
  if (!opts?.sticky) window.setTimeout(() => dismiss(id), AUTO_CLOSE_MS[level])
}

export function dismiss(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

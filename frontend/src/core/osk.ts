// Global on-screen keyboard state. ANY focused text input summons the keyboard - no opt-in
// attribute, because the rule for this device is absolute: nothing on the screen may require
// a physical keyboard. The keyboard component itself never steals focus (it preventDefaults
// its pointerdowns), so the input keeps the caret and a focus move anywhere else closes it.

import { shallowRef, watch } from 'vue'

export const oskTarget = shallowRef<HTMLInputElement | null>(null)

// Mark the root while the keyboard is docked, so fixed-position overlays anchored to the bottom
// edge (toasts, the pending-prompt chip) can lift above it in plain CSS - they live outside any
// component that could bind to oskTarget.
watch(oskTarget, (t) => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('osk-docked', !!t)
  }
})

// Only input types that support the text-selection API (selectionStart / setRangeText); 'email'
// and 'number' are deliberately excluded - the selection API throws on them, so the keyboard
// would appear yet type nothing.
const TEXTUAL = new Set(['text', 'search', 'url', 'tel', 'password'])

function isTextInput(el: EventTarget | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement && TEXTUAL.has(el.type) && !el.readOnly && !el.disabled
}

let bound = false

/** Install the document-level focus watcher once (the shell calls this on mount). */
export function bindOsk(): void {
  if (bound) return
  bound = true
  document.addEventListener('focusin', (e) => {
    if (isTextInput(e.target)) oskTarget.value = e.target
  })
  document.addEventListener('focusout', (e) => {
    if (e.target === oskTarget.value) oskTarget.value = null
  })
}

/** Close the keyboard and release the input (the keyboard's own close key). */
export function closeOsk(): void {
  const el = oskTarget.value
  oskTarget.value = null
  el?.blur()
}

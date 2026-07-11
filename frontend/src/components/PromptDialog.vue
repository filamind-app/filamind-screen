<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PromptDialog as PromptDialogData, PromptButton } from '@filamind-app/core'
import { useSessionStore } from '@/core/store/session'
import { useControlStore, type ControlError } from '@/core/store/control'

const { t } = useI18n()
const session = useSessionStore()
const ctl = useControlStore()

const dialog = ref<PromptDialogData | null>(null)
/** Failure of THIS dialog's own button gcode (the store's lastError may belong to another flight). */
const error = ref<ControlError | null>(null)
/** A button's gcode is in flight: every button disables (a double-tap would run it twice). */
const pending = ref(false)
/** Tucked away (stray backdrop tap / Escape) but NOT discarded: the macro is still waiting for
 *  an answer and only the server can end the prompt - a chip re-opens it. */
const hidden = ref(false)
const panel = ref<HTMLElement | null>(null)
let opener: HTMLElement | null = null

watch(
  () => session.prompt,
  (ev) => {
    if (!ev) return
    if (ev.type === 'show') void open(ev.dialog)
    else close()
  },
  { immediate: true },
)
watch(
  () => session.live,
  (live) => {
    if (!live) close()
  },
)

async function open(d: PromptDialogData): Promise<void> {
  opener = document.activeElement as HTMLElement | null
  dialog.value = d
  error.value = null
  hidden.value = false
  await nextTick()
  const first = panel.value?.querySelector<HTMLElement>('button')
  ;(first ?? panel.value)?.focus()
}
function close(): void {
  if (!dialog.value) return
  dialog.value = null
  error.value = null
  hidden.value = false
  opener?.focus()
}
function hide(): void {
  if (!dialog.value) return
  hidden.value = true
  opener?.focus()
}
async function reopen(): Promise<void> {
  hidden.value = false
  await nextTick()
  const first = panel.value?.querySelector<HTMLElement>('button')
  ;(first ?? panel.value)?.focus()
}
async function clickButton(b: PromptButton): Promise<void> {
  if (pending.value) return
  if (b.gcode) {
    error.value = null
    pending.value = true
    try {
      // silent: the error renders inline in the dialog - a toast on top would say it twice.
      const err = await ctl.runGcode(b.gcode, { silent: true })
      if (err) {
        error.value = err
        return
      }
    } finally {
      pending.value = false
    }
  }
  close()
}
function trapTab(e: KeyboardEvent): void {
  const nodes = Array.from(panel.value?.querySelectorAll<HTMLElement>('button') ?? [])
  if (nodes.length === 0) return
  const first = nodes[0]!
  const last = nodes[nodes.length - 1]!
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
function onKey(e: KeyboardEvent): void {
  if (!dialog.value || hidden.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    hide()
  } else if (e.key === 'Tab') {
    trapTab(e)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <teleport to="body">
    <div v-if="dialog && !hidden" class="backdrop" @click.self="hide">
      <div
        ref="panel"
        class="prompt touch-card"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-labelledby="dialog.title ? 'prompt-title' : undefined"
        :aria-label="dialog.title ? undefined : t('prompt.title')"
      >
        <h2 v-if="dialog.title" id="prompt-title" class="prompt-title">{{ dialog.title }}</h2>
        <p v-for="(line, i) in dialog.text" :key="`t${i}`" class="prompt-line">{{ line }}</p>
        <p v-if="error" class="prompt-error" role="alert">
          {{ t('control.error.' + error) }}
        </p>

        <div class="prompt-actions">
          <button
            v-for="(b, i) in dialog.buttons"
            :key="`b${i}`"
            type="button"
            class="touch-btn"
            :class="{ 'touch-btn-primary': b.style === 'primary', warning: b.style === 'warning' }"
            :disabled="pending"
            @click="clickButton(b)"
          >
            {{ b.label }}
          </button>
          <button
            v-if="dialog.buttons.length === 0 && dialog.footer.length === 0"
            type="button"
            class="touch-btn"
            @click="close"
          >
            {{ t('prompt.close') }}
          </button>
        </div>

        <div v-if="dialog.footer.length" class="prompt-footer">
          <button
            v-for="(b, i) in dialog.footer"
            :key="`f${i}`"
            type="button"
            class="touch-btn"
            :disabled="pending"
            @click="clickButton(b)"
          >
            {{ b.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- The tucked-away prompt's way back: the macro is still waiting for its answer. -->
    <button v-if="dialog && hidden" type="button" class="reopen-chip touch-btn" @click="reopen">
      <span class="reopen-icon" aria-hidden="true">?</span>
      <span class="reopen-text">{{ dialog.title || t('prompt.reopen') }}</span>
    </button>
  </teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 60;
}
.prompt {
  width: min(35rem, 94vw);
  /* Ride the device UI-size control (spacing + type tokens) so the dialog's text and padding scale
     with the rest of the app, not just its buttons. */
  padding: var(--sp-6);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-height: 90vh;
  overflow-y: auto;
}
.prompt:focus {
  outline: none;
}
.prompt-title {
  margin: 0;
  font-size: var(--fs-title);
  font-weight: 600;
  color: var(--fm-text);
}
.prompt-line {
  margin: 0;
  font-size: var(--fs-body);
  color: var(--fm-text-muted);
}
.prompt-error {
  margin: 0;
  color: var(--fm-danger);
}
.prompt-actions,
.prompt-footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
}
.prompt-footer {
  border-top: 1px solid var(--fm-border);
  padding-top: var(--sp-4);
}
.warning {
  border-color: var(--fm-warning);
  color: var(--fm-warning);
}
.prompt-actions .touch-btn:disabled,
.prompt-footer .touch-btn:disabled {
  opacity: 0.45;
}
/* Pending-prompt chip: sits clear of the bottom-centered toasts, above content (z below the
   backdrop so re-opening layers correctly). */
.reopen-chip {
  position: fixed;
  inset-block-end: var(--sp-4);
  inset-inline-end: var(--sp-4);
  z-index: 55;
  border-color: var(--fm-warning);
  color: var(--fm-warning);
  box-shadow: 0 0.4rem 1.2rem rgba(0, 0, 0, 0.35);
}
/* The chip lifts above the docked keyboard so it never overlays the keys - rule in main.css. As a
   scoped `:global(html.osk-docked) .reopen-chip` the minifier collapsed it onto <html>. */
.reopen-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: var(--r-pill);
  border: 2px solid currentColor;
  font-weight: 700;
  font-size: 0.9rem;
}
.reopen-text {
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

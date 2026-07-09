<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PromptDialog as PromptDialogData, PromptButton } from '@filamind-app/core'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'

const { t } = useI18n()
const session = useSessionStore()
const ctl = useControlStore()

const dialog = ref<PromptDialogData | null>(null)
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
  await nextTick()
  const first = panel.value?.querySelector<HTMLElement>('button')
  ;(first ?? panel.value)?.focus()
}
function close(): void {
  if (!dialog.value) return
  dialog.value = null
  opener?.focus()
}
async function clickButton(b: PromptButton): Promise<void> {
  if (b.gcode) {
    await ctl.runGcode(b.gcode)
    if (ctl.lastError) return
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
  if (!dialog.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === 'Tab') {
    trapTab(e)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <teleport to="body">
    <div v-if="dialog" class="backdrop" @click.self="close">
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
        <p v-if="ctl.lastError" class="prompt-error" role="alert">
          {{ t('control.error.' + ctl.lastError) }}
        </p>

        <div class="prompt-actions">
          <button
            v-for="(b, i) in dialog.buttons"
            :key="`b${i}`"
            type="button"
            class="touch-btn"
            :class="{ 'touch-btn-primary': b.style === 'primary', warning: b.style === 'warning' }"
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
            @click="clickButton(b)"
          >
            {{ b.label }}
          </button>
        </div>
      </div>
    </div>
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
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 90vh;
  overflow-y: auto;
}
.prompt:focus {
  outline: none;
}
.prompt-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--fm-text);
}
.prompt-line {
  margin: 0;
  font-size: 1rem;
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
  gap: 0.75rem;
}
.prompt-footer {
  border-top: 1px solid var(--fm-border);
  padding-top: 1rem;
}
.warning {
  border-color: var(--fm-warning);
  color: var(--fm-warning);
}
</style>

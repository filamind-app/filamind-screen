<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onGcodeResponse } from '@/core/session'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'

// A g-code console: send any command through the gated control store and watch Klipper's responses.
// Responses arrive via the session's notify_gcode_response tee (onGcodeResponse) - send-and-watch
// the live g-code response stream.
const { t } = useI18n()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()

const emit = defineEmits<{ close: [] }>()

interface Line {
  id: number
  kind: 'sent' | 'recv'
  text: string
}
const lines = ref<Line[]>([])
const input = ref('')
const logEl = ref<HTMLElement | null>(null)
let seq = 0

function push(kind: 'sent' | 'recv', text: string): void {
  lines.value.push({ id: seq++, kind, text })
  // Keep the buffer bounded - a long print can emit thousands of lines.
  if (lines.value.length > 200) lines.value.splice(0, lines.value.length - 200)
  void nextTick(() => {
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  })
}

async function send(): Promise<void> {
  const cmd = input.value.trim()
  if (!cmd || !canWrite.value) return
  input.value = ''
  push('sent', cmd)
  await ctl.runGcode(cmd)
}

let off: (() => void) | undefined
onMounted(() => {
  off = onGcodeResponse((line) => push('recv', line))
})
onUnmounted(() => off?.())
</script>

<template>
  <div class="console">
    <header class="head">
      <button
        class="back touch-btn"
        type="button"
        :aria-label="t('console.back')"
        @click="emit('close')"
      >
        ‹
      </button>
      <h2 class="title">{{ t('console.title') }}</h2>
      <button class="touch-btn clear" type="button" :disabled="!lines.length" @click="lines = []">
        {{ t('console.clear') }}
      </button>
    </header>

    <div ref="logEl" class="log">
      <p v-if="!lines.length" class="muted">{{ t('console.empty') }}</p>
      <pre v-for="l in lines" :key="l.id" class="line" :class="l.kind"
        >{{ l.kind === 'sent' ? '> ' : '' }}{{ l.text }}</pre
      >
    </div>

    <form class="entry" @submit.prevent="send">
      <input
        v-model="input"
        class="input"
        type="text"
        :placeholder="t('console.placeholder')"
        :disabled="!canWrite"
        :title="canWrite ? '' : blockedReason"
        autocapitalize="off"
        autocomplete="off"
        spellcheck="false"
      />
      <button class="touch-btn-primary send" type="submit" :disabled="!canWrite || !input.trim()">
        {{ t('console.send') }}
      </button>
    </form>

    <p v-if="ctl.lastError" class="err" role="alert">{{ t('control.error.' + ctl.lastError) }}</p>
  </div>
</template>

<style scoped>
.console {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  height: 100%;
}
.head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.back {
  min-width: 3rem;
  font-size: 1.6rem;
  line-height: 1;
}
.title {
  margin: 0;
  flex: 1;
  font-family: var(--font-display, system-ui);
  font-size: 1.25rem;
  color: var(--fm-text);
}
.clear {
  font-size: 0.9rem;
}
.log {
  flex: 1;
  overflow: auto;
  background: var(--fm-surface);
  border: 1px solid var(--fm-border);
  border-radius: 12px;
  padding: 0.6rem 0.75rem;
  min-height: 8rem;
}
.muted {
  margin: 0;
  color: var(--fm-text-muted);
}
.line {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--fm-text-muted);
}
.line.sent {
  color: var(--fm-primary);
}
.entry {
  display: flex;
  gap: 0.5rem;
}
.input {
  flex: 1;
  min-height: 44px;
  padding: 0 0.8rem;
  font-family: var(--font-mono);
  font-size: 1rem;
  color: var(--fm-text);
  background: var(--fm-surface-2);
  border: 1px solid var(--fm-border);
  border-radius: 12px;
}
.input:disabled {
  opacity: 0.45;
}
.send {
  min-width: 5.5rem;
  font-weight: 700;
}
.send:disabled {
  opacity: 0.45;
}
.err {
  margin: 0;
  color: var(--fm-danger);
}
</style>

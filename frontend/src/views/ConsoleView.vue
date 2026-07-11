<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolHeader from '@/components/ToolHeader.vue'
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

// Recent commands, tap-to-refill - retyping on a touch panel is the console's real pain.
const history = ref<string[]>([])
function remember(cmd: string): void {
  history.value = [cmd, ...history.value.filter((c) => c !== cmd)].slice(0, 6)
}
function recall(cmd: string): void {
  input.value = cmd
}

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
  remember(cmd)
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
    <ToolHeader :title="t('console.title')" :back-label="t('console.back')" @close="emit('close')">
      <button class="touch-btn clear" type="button" :disabled="!lines.length" @click="lines = []">
        {{ t('console.clear') }}
      </button>
    </ToolHeader>

    <!-- The log is g-code, LTR by nature: in an RTL locale bidi reordering would mirror the
         '>' prompt and right-align commands, visually corrupting them. The empty-state line
         stays in the UI language and direction. -->
    <div ref="logEl" class="log" dir="ltr">
      <p v-if="!lines.length" class="muted" dir="auto">{{ t('console.empty') }}</p>
      <pre v-for="l in lines" :key="l.id" class="line" :class="l.kind"
        >{{ l.kind === 'sent' ? '> ' : '' }}{{ l.text }}</pre>
    </div>

    <!-- Tap a recent command to refill the input (typing is the pain on a touch panel). -->
    <div v-if="history.length" class="recent" :aria-label="t('console.recent')">
      <button
        v-for="c in history"
        :key="c"
        class="chip"
        type="button"
        :title="c"
        @click="recall(c)"
      >
        {{ c }}
      </button>
    </div>

    <form class="entry" @submit.prevent="send">
      <!-- Typed g-code stays LTR in RTL locales too. -->
      <input
        v-model="input"
        class="input"
        type="text"
        dir="ltr"
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
  </div>
</template>

<style scoped>
.console {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  height: 100%;
}
.clear {
  font-size: 0.9rem;
}
.log {
  flex: 1;
  overflow: auto;
  background: var(--fm-surface);
  border: 1px solid var(--fm-border);
  border-radius: 0.75rem;
  padding: var(--sp-2) var(--sp-3);
  min-height: 8rem;
}
/* With the keyboard docked the log yields its min-height floor so the entry row and its chips stay
   above the keys - rule in main.css. As a scoped `:global(html.osk-docked) .log` the minifier
   collapsed it onto <html>, so the log kept its full floor and pushed the entry row behind the keys. */
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
.recent {
  display: flex;
  gap: var(--sp-1);
  overflow-x: auto;
  flex-shrink: 0;
}
.chip {
  flex-shrink: 0;
  max-width: 11rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-height: 2.25rem;
  padding: 0.15rem 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--fm-text-muted);
  background: var(--fm-surface-2);
  border: 1px solid var(--fm-border);
  border-radius: 999px;
  cursor: pointer;
}
.entry {
  display: flex;
  gap: var(--sp-2);
}
.input {
  flex: 1;
  min-height: var(--touch);
  padding: 0 var(--sp-3);
  font-family: var(--font-mono);
  font-size: var(--fs-body);
  color: var(--fm-text);
  background: var(--fm-surface-2);
  border: 1px solid var(--fm-border);
  border-radius: 0.75rem;
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
</style>

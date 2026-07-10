<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'

// One button per printer-defined macro (from the live config), so the daily macros - park,
// purge, level, filament routines - are one tap away. Underscore-prefixed macros are internal
// helpers by Klipper convention and stay hidden. Writes are gated like everything else.
const { t } = useI18n()
const store = useSessionStore()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()

const emit = defineEmits<{ close: [] }>()

interface ConfigFile {
  settings?: Record<string, unknown>
}
const macros = computed<string[]>(() => {
  const settings = store.object<ConfigFile>('configfile')?.settings ?? {}
  return Object.keys(settings)
    .filter((k) => k.startsWith('gcode_macro '))
    .map((k) => k.slice('gcode_macro '.length))
    .filter((name) => !name.startsWith('_'))
    .sort()
})

// Never inject a macro into a RUNNING job (a park/level/load macro mid-print drags the head
// through the part); a paused print is the legitimate moment for pause-time macros.
const printing = computed(
  () => store.object<{ state?: string }>('print_stats')?.state === 'printing',
)
const canRun = computed(() => canWrite.value && !printing.value)
const runBlockedReason = computed(() => (printing.value ? t('files.busy') : blockedReason.value))

function run(name: string): void {
  if (!canRun.value) return
  void ctl.runGcode(name.toUpperCase())
}
</script>

<template>
  <div class="macros">
    <header class="head">
      <button
        class="back touch-btn"
        type="button"
        :aria-label="t('macros.back')"
        @click="emit('close')"
      >
        ‹
      </button>
      <h2 class="title">{{ t('macros.title') }}</h2>
    </header>

    <p v-if="!macros.length" class="muted">{{ t('macros.empty') }}</p>
    <div v-else class="grid">
      <button
        v-for="m in macros"
        :key="m"
        class="touch-btn macro"
        type="button"
        :disabled="!canRun"
        :title="canRun ? '' : runBlockedReason"
        @click="run(m)"
      >
        {{ m.toUpperCase() }}
      </button>
    </div>

    <p v-if="ctl.lastError" class="err" role="alert">{{ t('control.error.' + ctl.lastError) }}</p>
  </div>
</template>

<style scoped>
.macros {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  min-height: 0;
}
.head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.back {
  min-width: 3rem;
  min-height: 3rem;
  padding: 0;
  font-size: 1.6rem;
  line-height: 1;
}
:global([dir='rtl']) .back {
  transform: scaleX(-1);
}
.title {
  margin: 0;
  font-family: var(--font-display, system-ui);
  font-size: 1.25rem;
  color: var(--fm-text);
}
.muted {
  margin: 0;
  color: var(--fm-text-muted);
}
.grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(12rem, 100%), 1fr));
  gap: 0.6rem;
  align-content: start;
}
.macro {
  min-height: 3.5rem;
  padding: 0.5rem 0.6rem;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  word-break: break-all;
}
.touch-btn:disabled {
  opacity: 0.45;
}
.err {
  margin: 0;
  color: var(--fm-danger);
}
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { connector } from '@/core/session'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'

// Browse the printer's g-code files (Moonraker `gcodes` root) and start one. Starting a print is a
// gated write (refused unless live + Klippy ready) and is blocked while a print is already running.
const { t } = useI18n()
const session = useSessionStore()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()

const emit = defineEmits<{ close: [] }>()

interface FileEntry {
  path: string
  modified?: number
  size?: number
}
const files = ref<FileEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const selected = ref<string | null>(null)

const printState = computed(
  () => session.object<{ state?: string }>('print_stats')?.state ?? 'standby',
)
const isPrinting = computed(() => printState.value === 'printing' || printState.value === 'paused')

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  selected.value = null
  try {
    const list = await connector.call<FileEntry[]>('server.files.list', { root: 'gcodes' })
    files.value = [...list].sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function startSelected(): Promise<void> {
  if (!selected.value || !canWrite.value || isPrinting.value) return
  await ctl.startPrint(selected.value)
  if (!ctl.lastError) emit('close')
}

function fmtSize(b?: number): string {
  if (!b) return ''
  return b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`
}
function fmtDate(s?: number): string {
  return s ? new Date(s * 1000).toLocaleDateString() : ''
}

onMounted(load)
</script>

<template>
  <div class="files">
    <header class="head">
      <button
        class="back touch-btn"
        type="button"
        :aria-label="t('files.back')"
        @click="emit('close')"
      >
        ‹
      </button>
      <h2 class="title">{{ t('files.title') }}</h2>
      <button class="touch-btn refresh" type="button" :disabled="loading" @click="load">
        {{ t('files.refresh') }}
      </button>
    </header>

    <p v-if="loading" class="muted">{{ t('files.loading') }}</p>
    <p v-else-if="error" class="err" role="alert">{{ error }}</p>
    <p v-else-if="!files.length" class="muted">{{ t('files.empty') }}</p>

    <ul v-else class="list">
      <li v-for="f in files" :key="f.path">
        <button
          class="file touch-card"
          :class="{ sel: selected === f.path }"
          type="button"
          :aria-pressed="selected === f.path"
          @click="selected = f.path"
        >
          <span class="file-name">{{ f.path }}</span>
          <span class="file-meta"
            >{{ fmtSize(f.size)
            }}<template v-if="f.modified"> · {{ fmtDate(f.modified) }}</template></span
          >
        </button>
      </li>
    </ul>

    <div v-if="selected" class="footer">
      <span v-if="isPrinting" class="muted">{{ t('files.busy') }}</span>
      <button
        v-else
        class="touch-btn-primary print"
        type="button"
        :disabled="!canWrite"
        :title="canWrite ? '' : blockedReason"
        @click="startSelected"
      >
        ▶ {{ t('files.print') }}
      </button>
    </div>

    <p v-if="ctl.lastError" class="err" role="alert">{{ t('control.error.' + ctl.lastError) }}</p>
  </div>
</template>

<style scoped>
.files {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
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
.refresh {
  font-size: 0.9rem;
}
.muted {
  margin: 0;
  color: var(--fm-text-muted);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow: auto;
}
.file {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.75rem 0.9rem;
  text-align: start;
  cursor: pointer;
}
.file.sel {
  border-color: var(--fm-primary);
}
.file-name {
  font-family: var(--font-mono);
  color: var(--fm-text);
  word-break: break-all;
}
.file-meta {
  font-size: 0.8rem;
  color: var(--fm-text-muted);
}
.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 0.3rem;
}
.print {
  min-width: 9rem;
  font-weight: 700;
}
.err {
  margin: 0;
  color: var(--fm-danger);
}
</style>

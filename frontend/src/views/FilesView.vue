<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { connector, moonrakerHttpBase } from '@/core/session'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'

// Browse the printer's g-code files with real folders, and start one behind a confirm card that
// shows what the slicer promised: estimated time, filament, and the embedded thumbnail. Starting
// a print is a gated write (refused unless live + Klippy ready) and blocked while one is running.
const { t } = useI18n()
const session = useSessionStore()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()

const emit = defineEmits<{ close: [] }>()

interface DirEntry {
  dirname: string
}
interface FileEntry {
  filename: string
  modified?: number
  size?: number
}
interface Thumb {
  width?: number
  relative_path?: string
}
interface Metadata {
  estimated_time?: number
  filament_total?: number
  thumbnails?: Thumb[]
}

/** Current folder relative to the gcodes root ('' = the root). */
const path = ref('')
const dirs = ref<DirEntry[]>([])
const files = ref<FileEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
/** Selected file's path relative to the gcodes root, + its slicer metadata (best-effort). */
const selected = ref<string | null>(null)
const meta = ref<Metadata | null>(null)

const printState = computed(
  () => session.object<{ state?: string }>('print_stats')?.state ?? 'standby',
)
const isPrinting = computed(() => printState.value === 'printing' || printState.value === 'paused')

async function load(target: string = path.value): Promise<void> {
  loading.value = true
  error.value = null
  selected.value = null
  meta.value = null
  try {
    const res = await connector.call<{ dirs?: DirEntry[]; files?: FileEntry[] }>(
      'server.files.get_directory',
      { path: target ? `gcodes/${target}` : 'gcodes' },
    )
    // Commit the path only on success - a failed descent must not strand the view on a
    // broken path with no way back.
    path.value = target
    dirs.value = (res.dirs ?? [])
      .filter((d) => !d.dirname.startsWith('.'))
      .sort((a, b) => a.dirname.localeCompare(b.dirname))
    files.value = [...(res.files ?? [])].sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function enter(dir: string): void {
  void load(path.value ? `${path.value}/${dir}` : dir)
}
function up(): void {
  void load(path.value.split('/').slice(0, -1).join('/'))
}

/** A listing entry's path relative to the gcodes root. */
const relOf = (name: string): string => (path.value ? `${path.value}/${name}` : name)

async function select(name: string): Promise<void> {
  const rel = relOf(name)
  selected.value = rel
  meta.value = null
  try {
    const m = await connector.call<Metadata>('server.files.metadata', { filename: rel })
    if (selected.value === rel) meta.value = m // ignore a stale response after a rapid re-tap
  } catch {
    if (selected.value === rel) meta.value = {} // no slicer metadata - the card is just barer
  }
}

/** The largest embedded thumbnail's URL (thumbnail paths are relative to the file's folder). */
const thumbUrl = computed(() => {
  const thumbs = meta.value?.thumbnails ?? []
  if (!thumbs.length || !selected.value) return null
  const best = [...thumbs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
  if (!best?.relative_path) return null
  const folder = selected.value.split('/').slice(0, -1).join('/')
  const rel = folder ? `${folder}/${best.relative_path}` : best.relative_path
  // Encode each segment: thumbnail paths embed the print's filename, and a '#', '?' or '%'
  // in it would otherwise truncate or corrupt the URL.
  const enc = rel.split('/').map(encodeURIComponent).join('/')
  return `${moonrakerHttpBase()}/server/files/gcodes/${enc}`
})

const fmtDuration = (s?: number): string => {
  if (!s || s <= 0) return '-'
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`
}
const fmtFilament = (mm?: number): string => (mm && mm > 0 ? `${(mm / 1000).toFixed(1)} m` : '-')

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
      <!-- Paths render LTR even in RTL locales - bidi reordering visually corrupts them. -->
      <span v-if="path" class="crumb" dir="ltr" :title="path">/{{ path }}</span>
      <button class="touch-btn refresh" type="button" :disabled="loading" @click="load()">
        {{ t('files.refresh') }}
      </button>
    </header>

    <p v-if="loading" class="muted">{{ t('files.loading') }}</p>
    <p v-else-if="error" class="err" role="alert">{{ error }}</p>
    <p v-else-if="!dirs.length && !files.length && !path" class="muted">{{ t('files.empty') }}</p>

    <ul v-if="!loading && !error" class="list">
      <li v-if="path">
        <button class="file touch-card dir" type="button" @click="up">
          <span class="file-name">‹ {{ t('files.up') }}</span>
        </button>
      </li>
      <li v-for="d in dirs" :key="'d-' + d.dirname">
        <button class="file touch-card dir" type="button" @click="enter(d.dirname)">
          <span class="file-name">📁 {{ d.dirname }}</span>
        </button>
      </li>
      <li v-for="f in files" :key="f.filename">
        <button
          class="file touch-card"
          :class="{ sel: selected === relOf(f.filename) }"
          type="button"
          :aria-pressed="selected === relOf(f.filename)"
          @click="select(f.filename)"
        >
          <span class="file-name">{{ f.filename }}</span>
          <span class="file-meta"
            >{{ fmtSize(f.size)
            }}<template v-if="f.modified"> · {{ fmtDate(f.modified) }}</template></span
          >
        </button>
      </li>
    </ul>

    <!-- Confirm card: what the slicer promised, then one explicit start tap. -->
    <div v-if="selected" class="confirm touch-card">
      <img v-if="thumbUrl" class="thumb" :src="thumbUrl" alt="" />
      <div class="confirm-info">
        <span class="confirm-name" dir="ltr" :title="selected">{{ selected }}</span>
        <span class="confirm-meta">
          ⏱ {{ fmtDuration(meta?.estimated_time) }} · 🧵 {{ fmtFilament(meta?.filament_total) }}
        </span>
      </div>
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
.crumb {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--fm-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.head .refresh {
  margin-inline-start: auto;
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
  flex: 1;
  min-height: 0;
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
.dir .file-name {
  color: var(--fm-text);
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
.confirm {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.9rem;
}
.thumb {
  width: 4.5rem;
  height: 4.5rem;
  object-fit: contain;
  border-radius: 0.5rem;
  background: var(--fm-surface-2);
}
.confirm-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.confirm-name {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: var(--fm-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.confirm-meta {
  font-size: 0.85rem;
  color: var(--fm-text-muted);
}
.print {
  min-width: 8rem;
  font-weight: 700;
}
.err {
  margin: 0;
  color: var(--fm-danger);
}
</style>

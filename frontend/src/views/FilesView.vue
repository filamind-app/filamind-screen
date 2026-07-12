<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/AppIcon.vue'
import ToolHeader from '@/components/ToolHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { connector } from '@/core/session'
import { fetchMetadata, thumbnailUrl, type GcodeMetadata } from '@/core/files'
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

/** Current folder relative to the gcodes root ('' = the root). */
const path = ref('')
const dirs = ref<DirEntry[]>([])
const files = ref<FileEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
/** Selected file's path relative to the gcodes root, + its slicer metadata (best-effort). */
const selected = ref<string | null>(null)
const meta = ref<GcodeMetadata | null>(null)

// Per-file thumbnails for the list, so the browser is a visual part picker, not a wall of names.
// One metadata call per file is too much to fire all at once, so a small pool fetches them a few
// at a time after each folder loads. (An IntersectionObserver "lazy on scroll" pass was tried and
// dropped: its callback never fired in the packaged webview even for in-viewport rows, so no
// thumbnail loaded - a bounded eager fetch is reliable everywhere.) `null` = looked up, no embedded
// thumbnail (a bare doc icon); `undefined` = not looked up yet.
const thumbs = ref<Record<string, string | null>>({})
const pendingThumbs = new Set<string>()
async function loadThumb(rel: string): Promise<void> {
  if (rel in thumbs.value || pendingThumbs.has(rel)) return
  pendingThumbs.add(rel)
  try {
    const m = await fetchMetadata(rel)
    thumbs.value = { ...thumbs.value, [rel]: thumbnailUrl(rel, m) }
  } catch {
    thumbs.value = { ...thumbs.value, [rel]: null }
  } finally {
    pendingThumbs.delete(rel)
  }
}

// Bounded-concurrency fetch for a whole listing; the token aborts in-flight workers when the user
// changes folders, so a slow previous folder can't keep populating the new one.
let thumbToken = 0
async function loadThumbsFor(rels: string[]): Promise<void> {
  const mine = ++thumbToken
  const queue = [...rels]
  const worker = async (): Promise<void> => {
    while (queue.length && mine === thumbToken) {
      const rel = queue.shift()
      if (rel) await loadThumb(rel)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
}

const printState = computed(
  () => session.object<{ state?: string }>('print_stats')?.state ?? 'standby',
)
const isPrinting = computed(() => printState.value === 'printing' || printState.value === 'paused')

async function load(target: string = path.value): Promise<void> {
  loading.value = true
  error.value = null
  selected.value = null
  meta.value = null
  thumbs.value = {} // a new listing re-fetches thumbnails for whatever scrolls into view
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
    // Fill in the list thumbnails a few at a time (bounded so a big folder doesn't burst).
    void loadThumbsFor(files.value.map((f) => relOf(f.filename)))
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
    const m = await fetchMetadata(rel)
    if (selected.value === rel) meta.value = m // ignore a stale response after a rapid re-tap
  } catch {
    if (selected.value === rel) meta.value = {} // no slicer metadata - the card is just barer
  }
}

const thumbUrl = computed(() => (selected.value ? thumbnailUrl(selected.value, meta.value) : null))

const fmtDuration = (s?: number): string => {
  if (!s || s <= 0) return '-'
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`
}
const fmtFilament = (mm?: number): string => (mm && mm > 0 ? `${(mm / 1000).toFixed(1)} m` : '-')

/** In-flight guard: a double-tap must not queue the print twice. */
const starting = ref(false)
async function startSelected(): Promise<void> {
  if (!selected.value || !canWrite.value || isPrinting.value || starting.value) return
  starting.value = true
  try {
    // Branch on THIS call's outcome, not the store's shared lastError (another concurrent flight
    // could overwrite or clear it while startPrint is in flight).
    const err = await ctl.startPrint(selected.value)
    if (!err) emit('close')
  } finally {
    starting.value = false
  }
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
    <ToolHeader :title="t('files.title')" :back-label="t('files.back')" @close="emit('close')">
      <!-- Paths render LTR even in RTL locales - bidi reordering visually corrupts them. -->
      <span v-if="path" class="crumb" dir="ltr" :title="path">/{{ path }}</span>
      <button
        class="touch-btn refresh"
        type="button"
        :aria-label="t('files.refresh')"
        :disabled="loading"
        @click="load()"
      >
        <Icon name="refresh" size="1.3rem" />
      </button>
    </ToolHeader>

    <p v-if="loading" class="muted">{{ t('files.loading') }}</p>
    <p v-else-if="error" class="err" role="alert">{{ error }}</p>
    <EmptyState
      v-else-if="!dirs.length && !files.length && !path"
      icon="files"
      :text="t('files.empty')"
    />

    <ul v-if="!loading && !error" class="list">
      <li v-if="path">
        <button class="file touch-card dir" type="button" @click="up">
          <span class="file-name row-with-icon"
            ><Icon name="up" size="1.1rem" /> {{ t('files.up') }}</span
          >
        </button>
      </li>
      <li v-for="d in dirs" :key="'d-' + d.dirname">
        <button class="file touch-card dir" type="button" @click="enter(d.dirname)">
          <!-- Names render LTR even in RTL locales, like the crumb and the confirm card:
               bidi reordering visually corrupts technical names. -->
          <span class="file-name row-with-icon" dir="ltr"
            ><Icon name="folder" size="1.1rem" /> {{ d.dirname }}</span
          >
        </button>
      </li>
      <li v-for="f in files" :key="f.filename">
        <button
          class="file touch-card file-row"
          :class="{ sel: selected === relOf(f.filename) }"
          type="button"
          :aria-pressed="selected === relOf(f.filename)"
          @click="select(f.filename)"
        >
          <span class="file-thumb">
            <img
              v-if="thumbs[relOf(f.filename)]"
              :src="thumbs[relOf(f.filename)] as string"
              alt=""
            />
            <Icon v-else name="doc" size="1.3rem" />
          </span>
          <span class="file-text">
            <span class="file-name" dir="ltr">{{ f.filename }}</span>
            <span class="file-meta"
              >{{ fmtSize(f.size)
              }}<template v-if="f.modified"> · {{ fmtDate(f.modified) }}</template></span
            >
          </span>
        </button>
      </li>
    </ul>

    <!-- Confirm card: what the slicer promised, then one explicit start tap. -->
    <div v-if="selected" class="confirm touch-card">
      <img v-if="thumbUrl" class="thumb" :src="thumbUrl" alt="" />
      <div class="confirm-info">
        <span class="confirm-name" dir="ltr" :title="selected">{{ selected }}</span>
        <span class="confirm-meta row-with-icon">
          <Icon name="status" size="1rem" /> {{ fmtDuration(meta?.estimated_time) }}
          <Icon name="filament" size="1rem" /> {{ fmtFilament(meta?.filament_total) }}
        </span>
      </div>
      <span v-if="isPrinting" class="muted">{{ t('files.busy') }}</span>
      <button
        v-else
        class="touch-btn-primary print"
        type="button"
        :disabled="!canWrite || starting"
        :title="canWrite ? '' : blockedReason"
        @click="startSelected"
      >
        <Icon name="play" size="1.2rem" /> {{ t('files.print') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.files {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  height: 100%;
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
  gap: var(--sp-2);
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
  padding: var(--sp-3);
  text-align: start;
  cursor: pointer;
}
.file.sel {
  border-color: var(--fm-primary);
}
/* Gcode rows carry a thumbnail: lay them out as [preview] [name + meta] instead of a name column. */
.file-row {
  flex-direction: row;
  align-items: center;
  gap: var(--sp-3);
}
.file-thumb {
  flex-shrink: 0;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: var(--fm-surface-2);
  color: var(--fm-text-muted);
  overflow: hidden;
}
.file-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.file-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}
.file-row .file-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: normal;
}
.dir .file-name {
  color: var(--fm-text);
}
.file-name {
  font-family: var(--font-mono);
  color: var(--fm-text);
  word-break: break-all;
}
.row-with-icon {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}
.file-meta {
  font-size: 0.8rem;
  color: var(--fm-text-muted);
}
.confirm {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
}
.thumb {
  width: 5.5rem;
  height: 5.5rem;
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
.print:disabled {
  opacity: 0.45;
}
.err {
  margin: 0;
  color: var(--fm-danger);
}
</style>

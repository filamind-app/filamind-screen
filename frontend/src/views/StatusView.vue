<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'

// A big-touch job-status screen: a circular progress ring, live temperature / motion tiles, and a
// row of print actions. The shell owns the brand bar + E-STOP + tab nav; this view is the job face.
const { t, te } = useI18n()
const store = useSessionStore()
const ctl = useControlStore()

// Switch the shell tab (Move / Tune / Files / Console jump to where those tools live).
const emit = defineEmits<{
  navigate: [to: 'status' | 'control' | 'settings' | 'move' | 'tune' | 'files' | 'console']
}>()

interface Heater {
  temperature?: number
  target?: number
}
interface PrintStats {
  state?: string
  filename?: string
  print_duration?: number
  info?: { current_layer?: number | null; total_layer?: number | null }
}

const ext = computed(() => store.object<Heater>('extruder'))
const bed = computed(() => store.object<Heater>('heater_bed'))
const fan = computed(() => store.object<{ speed?: number }>('fan'))
const gmove = computed(() => store.object<{ speed_factor?: number }>('gcode_move'))
const stats = computed<PrintStats>(() => store.object<PrintStats>('print_stats') ?? {})
const sdProgress = computed(() => store.object<{ progress?: number }>('virtual_sdcard')?.progress)
const dispProgress = computed(() => store.object<{ progress?: number }>('display_status')?.progress)

const progress = computed(() => Math.round((sdProgress.value ?? dispProgress.value ?? 0) * 100))
const layer = computed(() => stats.value.info ?? {})
const fanPct = computed(() => Math.round((fan.value?.speed ?? 0) * 100))
const speedPct = computed(() => Math.round((gmove.value?.speed_factor ?? 1) * 100))

const printing = computed(() => stats.value.state === 'printing')
const paused = computed(() => stats.value.state === 'paused')
const active = computed(() => printing.value || paused.value)

const stateLabel = computed(() => {
  const key = `status.state.${stats.value.state ?? 'standby'}`
  return te(key) ? t(key) : (stats.value.state ?? '-')
})

// Remaining-time estimate from elapsed print time and fraction done (no slicer estimate needed).
const eta = computed(() => {
  const frac = sdProgress.value ?? dispProgress.value ?? 0
  const elapsed = stats.value.print_duration ?? 0
  if (!active.value || frac <= 0.01 || elapsed <= 0) return ''
  const remaining = (elapsed * (1 - frac)) / frac
  const m = Math.round(remaining / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}m`
})

const fmt = (n?: number): string => `${Math.round(n ?? 0)}°`

// Ring geometry (r=42 -> circumference 263.9), offset shrinks as progress grows.
const CIRC = 2 * Math.PI * 42
const dashOffset = computed(() => CIRC * (1 - progress.value / 100))

interface Action {
  key: string
  label: string
  icon: string
  run: () => void
  disabled?: boolean
}
const actions = computed<Action[]>(() => [
  paused.value
    ? { key: 'resume', label: t('control.resume'), icon: '▶', run: () => ctl.resume() }
    : {
        key: 'pause',
        label: t('control.pause'),
        icon: '⏸',
        run: () => ctl.pause(),
        disabled: !printing.value || ctl.busy,
      },
  { key: 'tune', label: t('status.tune'), icon: '🎚', run: () => emit('navigate', 'tune') },
  { key: 'move', label: t('status.move'), icon: '✥', run: () => emit('navigate', 'move') },
  { key: 'files', label: t('status.files'), icon: '📁', run: () => emit('navigate', 'files') },
  { key: 'console', label: t('status.console'), icon: '⌨', run: () => emit('navigate', 'console') },
])

interface Tile {
  key: string
  label: string
  icon: string
  value: string
  sub?: string
}
const tiles = computed<Tile[]>(() => [
  {
    key: 'ext',
    label: t('status.hotend'),
    icon: '🔥',
    value: fmt(ext.value?.temperature),
    sub: `/ ${fmt(ext.value?.target)}`,
  },
  {
    key: 'bed',
    label: t('status.bed'),
    icon: '🛏',
    value: fmt(bed.value?.temperature),
    sub: `/ ${fmt(bed.value?.target)}`,
  },
  { key: 'fan', label: t('status.fan'), icon: '🌀', value: `${fanPct.value}`, sub: '%' },
  { key: 'speed', label: t('status.speed'), icon: '⏱', value: `${speedPct.value}`, sub: '%' },
])
</script>

<template>
  <div class="status">
    <!-- Job face: ring + live tiles -->
    <div class="job">
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 100 100" role="img" :aria-label="`${progress}%`">
          <circle class="ring-track" cx="50" cy="50" r="42" fill="none" />
          <circle
            class="ring-fill"
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke-linecap="round"
            :stroke-dasharray="CIRC"
            :stroke-dashoffset="dashOffset"
            transform="rotate(-90 50 50)"
          />
          <text class="ring-pct" x="50" y="49" text-anchor="middle">{{ progress }}%</text>
          <text v-if="layer.total_layer" class="ring-sub" x="50" y="64" text-anchor="middle">
            {{ t('status.layer') }} {{ layer.current_layer ?? 0 }}/{{ layer.total_layer }}
          </text>
        </svg>
        <div class="file" :title="stats.filename || ''">{{ stats.filename || '-' }}</div>
        <div class="eta">
          <span class="state-dot" :class="stats.state"></span>{{ stateLabel
          }}<span v-if="eta"> · {{ t('status.eta') }} {{ eta }}</span>
        </div>
      </div>

      <div class="tiles">
        <div v-for="tile in tiles" :key="tile.key" class="tile touch-card">
          <div class="tile-label">
            <span aria-hidden="true">{{ tile.icon }}</span> {{ tile.label }}
          </div>
          <div class="tile-value">
            {{ tile.value }}<span class="tile-sub">{{ tile.sub }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Print actions -->
    <div class="actions">
      <button
        v-for="a in actions"
        :key="a.key"
        class="action touch-card"
        type="button"
        :disabled="a.disabled"
        @click="a.run()"
      >
        <span class="action-icon" aria-hidden="true">{{ a.icon }}</span>
        <span class="action-label">{{ a.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.status {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.job {
  display: flex;
  gap: 1.1rem;
  align-items: stretch;
}
.ring-wrap {
  flex-shrink: 0;
  width: 11rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.ring {
  width: 9.5rem;
  height: 9.5rem;
}
.ring-track {
  stroke: var(--fm-surface-2);
  stroke-width: 9;
}
.ring-fill {
  stroke: var(--fm-primary);
  stroke-width: 9;
  transition: stroke-dashoffset 0.4s ease;
}
.ring-pct {
  fill: var(--fm-text);
  font-size: 1.25rem;
  font-weight: 600;
  font-family: var(--font-display, system-ui);
}
.ring-sub {
  fill: var(--fm-text-muted);
  font-size: 0.55rem;
}
.file {
  margin-top: 0.3rem;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: var(--fm-text);
  max-width: 11rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--fm-text-muted);
}
.state-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--fm-text-muted);
}
.state-dot.printing {
  background: var(--fm-primary);
}
.state-dot.paused {
  background: var(--fm-warning);
}
.tiles {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.7rem;
}
.tile {
  padding: 0.85rem 0.9rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.tile-label {
  font-size: 0.85rem;
  color: var(--fm-text-muted);
}
.tile-value {
  margin-top: 0.25rem;
  font-family: var(--font-mono);
  font-size: 1.5rem;
  color: var(--fm-text);
}
.tile-sub {
  font-size: 0.85rem;
  color: var(--fm-text-muted);
  margin-inline-start: 0.2rem;
}
.actions {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.55rem;
}
.action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-height: 4.4rem;
  padding: 0.6rem 0;
  border: 0;
  cursor: pointer;
  color: var(--fm-primary);
}
.action:active {
  filter: brightness(0.92);
}
.action:disabled {
  opacity: 0.4;
  cursor: default;
}
.action-icon {
  font-size: 1.45rem;
  line-height: 1;
}
.action-label {
  font-size: 0.8rem;
  color: var(--fm-text);
}
</style>

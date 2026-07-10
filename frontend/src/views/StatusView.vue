<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/AppIcon.vue'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'

// The job face: a big progress ring, glanceable live tiles, and the PRINT actions only -
// navigation lives on the shell's rail, so this screen stays calm and readable at a distance.
const { t, te } = useI18n()
const store = useSessionStore()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()

const emit = defineEmits<{ navigate: [to: string] }>()

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

// Cancel is destructive: a second tap within 3s confirms.
const confirmingCancel = ref(false)
let cancelTimer: ReturnType<typeof setTimeout> | undefined
function onCancel(): void {
  if (confirmingCancel.value) {
    confirmingCancel.value = false
    if (cancelTimer) clearTimeout(cancelTimer)
    void ctl.cancel()
  } else {
    confirmingCancel.value = true
    cancelTimer = setTimeout(() => (confirmingCancel.value = false), 3000)
  }
}
onUnmounted(() => {
  if (cancelTimer) clearTimeout(cancelTimer)
})

interface Tile {
  key: string
  label: string
  icon: 'heat' | 'fan' | 'tune'
  value: string
  sub?: string
  to: 'temp' | 'tune'
}
const tiles = computed<Tile[]>(() => [
  {
    key: 'ext',
    label: t('status.hotend'),
    icon: 'heat',
    value: fmt(ext.value?.temperature),
    sub: `/ ${fmt(ext.value?.target)}`,
    to: 'temp',
  },
  {
    key: 'bed',
    label: t('status.bed'),
    icon: 'heat',
    value: fmt(bed.value?.temperature),
    sub: `/ ${fmt(bed.value?.target)}`,
    to: 'temp',
  },
  {
    key: 'fan',
    label: t('status.fan'),
    icon: 'fan',
    value: `${fanPct.value}`,
    sub: '%',
    to: 'tune',
  },
  {
    key: 'speed',
    label: t('status.speed'),
    icon: 'tune',
    value: `${speedPct.value}`,
    sub: '%',
    to: 'tune',
  },
])
</script>

<template>
  <div class="status">
    <!-- Job face: ring + live tiles -->
    <div class="job">
      <div class="ring-wrap">
        <!-- The box keeps the decorative motif concentric with the ring (not the whole column). -->
        <div class="ring-box">
          <span class="motif" aria-hidden="true"></span>
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
        </div>
        <div class="file" dir="ltr" :title="stats.filename || ''">{{ stats.filename || '-' }}</div>
        <div class="eta">
          <span class="state-dot" :class="stats.state"></span>{{ stateLabel
          }}<span v-if="eta"> · {{ t('status.eta') }} {{ eta }}</span>
        </div>
      </div>

      <div class="tiles">
        <button
          v-for="tile in tiles"
          :key="tile.key"
          class="tile touch-card"
          type="button"
          @click="emit('navigate', tile.to)"
        >
          <div class="tile-label"><Icon :name="tile.icon" size="1.1rem" /> {{ tile.label }}</div>
          <div class="tile-value">
            {{ tile.value }}<span class="tile-sub">{{ tile.sub }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Print actions only (navigation lives on the rail). -->
    <div class="actions">
      <button
        v-if="paused"
        class="touch-btn-primary action"
        type="button"
        :disabled="!canWrite"
        @click="ctl.resume()"
      >
        <Icon name="play" size="1.3rem" /> {{ t('control.resume') }}
      </button>
      <button
        v-else
        class="touch-btn action"
        type="button"
        :disabled="!printing || !canWrite"
        @click="ctl.pause()"
      >
        <Icon name="pause" size="1.3rem" /> {{ t('control.pause') }}
      </button>
      <button
        v-if="active"
        class="touch-btn action cancel"
        :class="{ warning: confirmingCancel }"
        type="button"
        :disabled="!canWrite"
        @click="onCancel"
      >
        <Icon name="stop" size="1.3rem" />
        {{ confirmingCancel ? t('control.cancelConfirm') : t('control.cancel') }}
      </button>
    </div>

    <!-- WHY the print actions are greyed out (safe mode / offline) - a touch panel has no hover
         tooltips, and unexplained disabled buttons on the job face read as a broken screen. -->
    <p v-if="active && !canWrite" class="blocked-hint" role="status">
      <Icon name="shield" size="1rem" /> {{ blockedReason }}
    </p>
  </div>
</template>

<style scoped>
.status {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
}
.job {
  display: flex;
  gap: var(--sp-4);
  align-items: stretch;
  flex: 1;
  min-height: 0;
}
.ring-wrap {
  flex-shrink: 0;
  width: 12rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
/* Positioning context sized to the ring itself so the motif stays concentric with it (anchored
   to the whole column it would sit offset below the ring and wash over the caption text). */
.ring-box {
  position: relative;
  width: 10rem;
  height: 10rem;
}
/* Decorative motif: a soft radial ornament whose visibility follows the setting. */
.motif {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 11.5rem;
  height: 11.5rem;
  border-radius: 50%;
  background: radial-gradient(circle, transparent 55%, var(--fm-primary) 56%, transparent 60%);
  opacity: 0;
  pointer-events: none;
}
:global(:root[data-fm-motif='subtle']) .motif {
  opacity: 0.1;
}
:global(:root[data-fm-motif='full']) .motif {
  opacity: 0.25;
}
.ring {
  width: 10rem;
  height: 10rem;
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
/* SVG text sizes are USER UNITS (the 0..100 viewBox), not rem: a rem font-size would scale with
   the SQUARE of the root font size (px resolve before the viewBox transform). */
.ring-pct {
  fill: var(--fm-text);
  font-size: 20px;
  font-weight: 600;
  font-family: var(--font-display, system-ui);
}
.ring-sub {
  fill: var(--fm-text-muted);
  font-size: 8.8px;
}
.file {
  margin-top: var(--sp-2);
  font-family: var(--font-mono);
  font-size: var(--fs-caption);
  color: var(--fm-text);
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eta {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-caption);
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
  gap: var(--sp-3);
}
.tile {
  padding: var(--sp-3) var(--sp-4);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  text-align: start;
  cursor: pointer;
}
.tile:active {
  filter: brightness(0.92);
}
.tile-label {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-caption);
  color: var(--fm-text-muted);
}
/* Glanceable numerals: readable from arm's length, the point of a printer screen. */
.tile-value {
  margin-top: var(--sp-1);
  font-family: var(--font-mono);
  font-size: var(--fs-display);
  line-height: 1.1;
  color: var(--fm-text);
}
.tile-sub {
  font-size: var(--fs-body);
  color: var(--fm-text-muted);
  margin-inline-start: var(--sp-1);
}
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
}
.action {
  min-height: 3.5rem;
  font-weight: 700;
}
.action:disabled {
  opacity: 0.45;
}
.cancel.warning {
  border-color: var(--fm-warning);
  color: var(--fm-warning);
}
.blocked-hint {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  font-size: var(--fs-caption);
  color: var(--fm-warning);
}
</style>

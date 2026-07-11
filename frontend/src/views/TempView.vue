<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import NumPad from '@/components/NumPad.vue'
import TempGraph from '@/components/TempGraph.vue'
import ToolHeader from '@/components/ToolHeader.vue'
import { useHeaters, heaterRange, type HeaterRow } from '@/core/heaters'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'

// Temperature control: every discovered heater with a tappable target (on-screen numpad,
// range-checked against the printer's own config), one-tap material presets, and the bare
// sensors read-only below. All writes go through the gated control store.
const { t, te } = useI18n()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()
const { heaters, sensors } = useHeaters()

const emit = defineEmits<{ close: [] }>()

/** Known heaters get a friendly translated name; the rest show their config name. */
function displayName(row: HeaterRow): string {
  const key = `temp.known.${row.name}`
  return te(key) ? t(key) : row.label
}

const editing = ref<HeaterRow | null>(null)
const editRange = computed(() =>
  editing.value ? heaterRange(editing.value.name) : { min: 0, max: 300 },
)
// If writes get blocked mid-entry (disconnect, safe mode), close the pad instead of letting
// OK silently discard the value.
watch(canWrite, (ok) => {
  if (!ok) editing.value = null
})

// The heater name is quoted: discovered names can contain a space ("heater_generic chamber"),
// which would otherwise split into a malformed command. Klipper accepts the quoted full name.
function setTarget(name: string, target: number): void {
  if (!canWrite.value) return
  void ctl.runGcode(`SET_HEATER_TEMPERATURE HEATER="${name}" TARGET=${target}`)
}
function confirmTarget(target: number): void {
  if (editing.value) setTarget(editing.value.name, target)
  editing.value = null
}

// One-tap material presets applied to the hotend(s) + bed (only what exists). A preset hotter
// than a heater's configured ceiling backs off BELOW it (max_temp is Klipper's shutdown
// threshold - targeting it exactly would let normal PID overshoot trip a firmware shutdown).
interface Preset {
  key: string
  hotend: number
  bed: number
}
const PRESETS: Preset[] = [
  { key: 'pla', hotend: 200, bed: 60 },
  { key: 'petg', hotend: 235, bed: 80 },
  { key: 'abs', hotend: 250, bed: 100 },
]
function applyPreset(p: Preset): void {
  if (!canWrite.value) return
  // ONE script for all heaters: the control store is busy while a call is in flight and would
  // silently drop a second per-heater call issued in the same loop.
  const lines: string[] = []
  for (const row of heaters.value) {
    const want = row.name.startsWith('extruder')
      ? p.hotend
      : row.name === 'heater_bed'
        ? p.bed
        : null
    if (want == null) continue
    const target = Math.min(want, Math.max(0, heaterRange(row.name).max - 5))
    lines.push(`SET_HEATER_TEMPERATURE HEATER="${row.name}" TARGET=${target}`)
  }
  if (lines.length) void ctl.runGcode(lines.join('\n'))
}
function allOff(): void {
  if (!canWrite.value) return
  // sticky: a failed heaters-off leaves the machine HOT - that error must outlive a glance away.
  void ctl.runGcode('TURN_OFF_HEATERS', { sticky: true })
}

const fmt = (n: number): string => `${Math.round(n)}°`

// The live graph plots every discovered heater + sensor under its display name.
const graphNames = computed(() => [...heaters.value, ...sensors.value].map((r) => r.name))
const graphLabels = computed(() => {
  const out: Record<string, string> = {}
  for (const r of [...heaters.value, ...sensors.value]) out[r.name] = displayName(r)
  return out
})
</script>

<template>
  <div class="temp">
    <ToolHeader :title="t('temp.title')" :back-label="t('temp.back')" @close="emit('close')" />

    <!-- Presets (hidden while entering a target: the numpad gets the full height budget). -->
    <div v-if="!editing" class="presets">
      <button
        v-for="p in PRESETS"
        :key="p.key"
        class="touch-btn preset"
        type="button"
        :disabled="!canWrite"
        :title="canWrite ? '' : blockedReason"
        @click="applyPreset(p)"
      >
        <span class="preset-name">{{ t('temp.preset.' + p.key) }}</span>
        <span class="preset-temps">{{ p.hotend }}° / {{ p.bed }}°</span>
      </button>
      <button class="touch-btn preset off" type="button" :disabled="!canWrite" @click="allOff">
        <span class="preset-name">{{ t('temp.off') }}</span>
        <span class="preset-temps">0°</span>
      </button>
    </div>

    <!-- Live history graph (hidden while entering a target: the numpad gets the height). -->
    <TempGraph v-if="!editing" :names="graphNames" :labels="graphLabels" />

    <!-- Heater rows (tap to set) + read-only sensors; the list scrolls, the chrome doesn't. -->
    <div v-if="!editing" class="list">
      <button
        v-for="row in heaters"
        :key="row.name"
        class="row touch-card heater"
        type="button"
        :disabled="!canWrite"
        :title="canWrite ? '' : blockedReason"
        @click="editing = row"
      >
        <span class="row-name">{{ displayName(row) }}</span>
        <span class="row-now">{{ fmt(row.temperature) }}</span>
        <span class="row-target" :class="{ on: row.target > 0 }">{{ fmt(row.target) }}</span>
      </button>
      <p v-if="!heaters.length" class="muted">{{ t('temp.none') }}</p>

      <template v-if="sensors.length">
        <div class="sensors-title">{{ t('temp.sensors') }}</div>
        <div v-for="row in sensors" :key="row.name" class="row touch-card sensor">
          <span class="row-name">{{ displayName(row) }}</span>
          <span class="row-now">{{ fmt(row.temperature) }}</span>
        </div>
      </template>
    </div>

    <!-- On-screen target entry for the tapped heater. -->
    <NumPad
      v-if="editing"
      :label="displayName(editing)"
      :min="editRange.min"
      :max="editRange.max"
      unit="°"
      @confirm="confirmTarget"
      @close="editing = null"
    />
  </div>
</template>

<style scoped>
.temp {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  height: 100%;
  min-height: 0;
}
.presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-2);
}
.preset {
  flex-direction: column;
  gap: 0.15rem;
  min-height: 3.5rem;
  padding: var(--sp-1);
}
.preset-name {
  font-weight: 700;
  font-size: var(--fs-body);
}
.preset-temps {
  font-size: 0.8rem;
  color: var(--fm-text-muted);
}
.off .preset-name {
  color: var(--fm-warning);
}
.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border-radius: 0.75rem;
}
.heater {
  cursor: pointer;
}
.heater:disabled {
  opacity: 0.45;
}
.row-name {
  flex: 1;
  text-align: start;
  font-size: 1.05rem;
  color: var(--fm-text);
}
.row-now {
  font-family: var(--font-mono);
  font-size: 1.2rem;
  color: var(--fm-text);
}
.row-target {
  font-family: var(--font-mono);
  font-size: 1rem;
  color: var(--fm-text-muted);
  min-width: 4.5rem;
  text-align: end;
}
/* Direction-aware "towards target" arrow (a hardcoded → points the wrong way in RTL). The RTL
   override lives in main.css - a scoped `:global([dir=rtl])` selector was collapsed by the
   minifier to a bare `[dir=rtl] { … }` on <html>. */
.row-target::before {
  content: '→ ';
}
.row-target.on {
  color: var(--fm-primary);
}
.sensor .row-now {
  color: var(--fm-text-muted);
}
.sensors-title {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: var(--fm-text-muted);
}
.muted {
  margin: 0;
  color: var(--fm-text-muted);
}
</style>

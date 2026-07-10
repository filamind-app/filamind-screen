<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import NumPad from '@/components/NumPad.vue'
import ToolHeader from '@/components/ToolHeader.vue'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'

// Live print tuning: speed (M220), flow (M221), Z babystep (SET_GCODE_OFFSET), part fan (M106).
// Reads the live factors off gcode_move / fan and applies relative nudges through the gated store.
const { t } = useI18n()
const session = useSessionStore()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()

const emit = defineEmits<{ close: [] }>()

interface GcodeMove {
  speed_factor?: number
  extrude_factor?: number
  homing_origin?: number[]
}
const gm = computed(() => session.object<GcodeMove>('gcode_move'))
const fan = computed(() => session.object<{ speed?: number }>('fan'))

const speedPct = computed(() => Math.round((gm.value?.speed_factor ?? 1) * 100))
const flowPct = computed(() => Math.round((gm.value?.extrude_factor ?? 1) * 100))
const zOffset = computed(() => gm.value?.homing_origin?.[2] ?? 0)
const fanPct = computed(() => Math.round((fan.value?.speed ?? 0) * 100))

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

function setSpeed(d: number): void {
  if (canWrite.value) void ctl.runGcode(`M220 S${clamp(speedPct.value + d, 10, 300)}`)
}
function setFlow(d: number): void {
  if (canWrite.value) void ctl.runGcode(`M221 S${clamp(flowPct.value + d, 50, 200)}`)
}
function adjustZ(d: number): void {
  if (canWrite.value) void ctl.runGcode(`SET_GCODE_OFFSET Z_ADJUST=${d.toFixed(3)} MOVE=1`)
}
function setFan(d: number): void {
  if (!canWrite.value) return
  const pct = clamp(fanPct.value + d, 0, 100)
  void ctl.runGcode(`M106 S${Math.round((pct * 255) / 100)}`)
}
function send(gcode: string): void {
  if (canWrite.value) void ctl.runGcode(gcode)
}

const PCT_STEPS = [-25, -5, 5, 25]
const Z_STEPS = [-0.05, -0.01, 0.01, 0.05]
const fmtPct = (d: number): string => (d > 0 ? `+${d}` : `${d}`)
const fmtZ = (d: number): string => (d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2))

interface Row {
  key: string
  label: string
  value: string
  steps: number[]
  fmtStep: (d: number) => string
  apply: (d: number) => void
  reset: () => void
  /** Absolute entry via the on-screen numpad (rows without it are nudge-only, e.g. Z). */
  abs?: { min: number; max: number; set: (v: number) => void }
}
const rows = computed<Row[]>(() => [
  {
    key: 'speed',
    label: t('tune.speed'),
    value: `${speedPct.value}%`,
    steps: PCT_STEPS,
    fmtStep: fmtPct,
    apply: setSpeed,
    reset: () => send('M220 S100'),
    abs: { min: 10, max: 300, set: (v) => send(`M220 S${Math.round(v)}`) },
  },
  {
    key: 'flow',
    label: t('tune.flow'),
    value: `${flowPct.value}%`,
    steps: PCT_STEPS,
    fmtStep: fmtPct,
    apply: setFlow,
    reset: () => send('M221 S100'),
    abs: { min: 50, max: 200, set: (v) => send(`M221 S${Math.round(v)}`) },
  },
  {
    key: 'zoff',
    label: t('tune.zOffset'),
    value: `${zOffset.value >= 0 ? '+' : ''}${zOffset.value.toFixed(3)}`,
    steps: Z_STEPS,
    fmtStep: fmtZ,
    apply: adjustZ,
    reset: () => send('SET_GCODE_OFFSET Z=0 MOVE=1'),
  },
  {
    key: 'fan',
    label: t('tune.fan'),
    value: `${fanPct.value}%`,
    steps: PCT_STEPS,
    fmtStep: fmtPct,
    apply: setFan,
    reset: () => send('M106 S0'),
    abs: { min: 0, max: 100, set: (v) => send(`M106 S${Math.round((v * 255) / 100)}`) },
  },
])

/** Row being edited via the on-screen numpad (tap a value); the cards yield the space meanwhile. */
const editing = ref<Row | null>(null)
function confirmAbs(v: number): void {
  editing.value?.abs?.set(v)
  editing.value = null
}
// If writes get blocked mid-entry (disconnect, safe mode), close the pad instead of letting
// OK silently discard the value.
watch(canWrite, (ok) => {
  if (!ok) editing.value = null
})
</script>

<template>
  <div class="tune">
    <ToolHeader
      class="head"
      :title="t('tune.title')"
      :back-label="t('tune.back')"
      @close="emit('close')"
    />

    <template v-if="!editing">
      <div v-for="r in rows" :key="r.key" class="row touch-card">
        <div class="row-head">
          <span class="row-label">{{ r.label }}</span>
          <!-- Tap the value for direct numpad entry (rows without an absolute range stay text). -->
          <button
            v-if="r.abs"
            class="row-value tappable"
            type="button"
            :disabled="!canWrite"
            @click="editing = r"
          >
            {{ r.value }}
          </button>
          <span v-else class="row-value">{{ r.value }}</span>
        </div>
        <div class="row-btns">
          <button
            v-for="d in r.steps"
            :key="d"
            class="touch-btn step"
            type="button"
            :disabled="!canWrite"
            :title="canWrite ? '' : blockedReason"
            @click="r.apply(d)"
          >
            {{ r.fmtStep(d) }}
          </button>
          <button
            class="touch-btn reset"
            type="button"
            :disabled="!canWrite"
            :aria-label="t('tune.reset')"
            @click="r.reset()"
          >
            ⟲
          </button>
        </div>
      </div>
    </template>

    <NumPad
      v-if="editing?.abs"
      class="pad"
      :label="editing.label"
      :min="editing.abs.min"
      :max="editing.abs.max"
      unit="%"
      @confirm="confirmAbs"
      @close="editing = null"
    />
  </div>
</template>

<style scoped>
/* 2x2 card grid: all four tuners visible at once inside the height budget (a stacked column
   always scrolled, and scrolled-off controls read as missing on a kiosk panel). */
.tune {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: min-content;
  align-content: start;
  gap: var(--sp-3);
  height: 100%;
  min-height: 0;
}
/* The class lands on ToolHeader's root: it only needs to span the grid here. */
.head {
  grid-column: 1 / -1;
}
.row {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
}
.row-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.row-label {
  color: var(--fm-text-muted);
  font-size: 0.95rem;
}
.row-value {
  font-family: var(--font-mono);
  font-size: 1.4rem;
  color: var(--fm-text);
}
/* Tap-to-type affordance on the values with an absolute range. */
button.row-value.tappable {
  border: 0;
  background: var(--fm-surface-2);
  border-radius: 0.5rem;
  padding: 0.1rem 0.5rem;
  cursor: pointer;
}
button.row-value.tappable:disabled {
  opacity: 0.45;
}
.pad {
  grid-column: 1 / -1;
}
.row-btns {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--sp-2);
}
.row-btns .touch-btn {
  min-height: var(--touch);
  padding: var(--sp-1) var(--sp-2);
  font-size: 0.95rem;
}
.reset {
  font-size: 1.3rem;
  color: var(--fm-text-muted);
}
.touch-btn:disabled {
  opacity: 0.45;
}
</style>

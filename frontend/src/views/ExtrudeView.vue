<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/AppIcon.vue'
import ToolHeader from '@/components/ToolHeader.vue'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'
import { heaterRange } from '@/core/heaters'

// Filament tool: extrude / retract with distance + speed presets, guarded by the printer's own
// cold-extrusion floor (below it the moves are refused and a one-tap heat button appears), plus
// the printer's load/unload macros when it defines them. Writes are gated like everything else.
const { t } = useI18n()
const store = useSessionStore()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()

const emit = defineEmits<{ close: [] }>()

interface Heater {
  temperature?: number
  target?: number
}
interface ConfigFile {
  settings?: Record<string, Record<string, unknown>>
}

const ext = computed(() => store.object<Heater>('extruder'))
const cfg = computed(() => store.object<ConfigFile>('configfile'))

/** The printer's cold-extrusion floor ([extruder] min_extrude_temp; Klipper default 170). */
const minExtrude = computed(() => {
  const v = cfg.value?.settings?.['extruder']?.['min_extrude_temp']
  return typeof v === 'number' ? v : 170
})
const nowTemp = computed(() => ext.value?.temperature ?? 0)
const cold = computed(() => nowTemp.value < minExtrude.value)
// Never feed filament INTO a running job (a stray 50mm extrude ruins the print); a paused
// print is the legitimate filament-change moment, so paused stays allowed.
const printing = computed(
  () => store.object<{ state?: string }>('print_stats')?.state === 'printing',
)
const canMove = computed(() => canWrite.value && !cold.value && !printing.value)
const moveBlockedReason = computed(() => {
  if (printing.value) return t('files.busy')
  if (cold.value) return t('extrude.cold', { t: Math.round(minExtrude.value) })
  return blockedReason.value
})

/** Load/unload buttons appear only when the printer defines the macros. */
const hasMacro = (name: string): boolean => !!cfg.value?.settings?.[`gcode_macro ${name}`]
const loadMacro = computed(() =>
  hasMacro('load_filament') ? 'LOAD_FILAMENT' : hasMacro('filament_load') ? 'FILAMENT_LOAD' : null,
)
const unloadMacro = computed(() =>
  hasMacro('unload_filament')
    ? 'UNLOAD_FILAMENT'
    : hasMacro('filament_unload')
      ? 'FILAMENT_UNLOAD'
      : null,
)

const DISTANCES = [5, 10, 25, 50]
const SPEEDS = [2, 5, 10] // mm/s
const distance = ref(10)
const speed = ref(5)

// Relative E move inside a saved/restored g-code state so the machine's own modes are untouched.
function feedMove(sign: 1 | -1): void {
  if (!canMove.value) return
  const d = (sign * distance.value).toFixed(1)
  const f = Math.round(speed.value * 60)
  void ctl.runGcode(
    `SAVE_GCODE_STATE NAME=_fm_extrude\nM83\nG1 E${d} F${f}\nRESTORE_GCODE_STATE NAME=_fm_extrude`,
  )
}
function heatUp(): void {
  if (!canWrite.value) return
  // A sane working temperature comfortably above the floor, backed off below the heater's
  // configured ceiling (its shutdown threshold) like the temperature presets.
  const target = Math.min(
    Math.max(minExtrude.value + 40, 210),
    Math.max(0, heaterRange('extruder').max - 5),
  )
  void ctl.runGcode(`SET_HEATER_TEMPERATURE HEATER=extruder TARGET=${target}`)
}
function runMacro(macro: string): void {
  if (!canMove.value) return
  void ctl.runGcode(macro)
}

const fmt = (n: number): string => `${Math.round(n)}°`
</script>

<template>
  <div class="extrude">
    <ToolHeader :title="t('extrude.title')" :back-label="t('extrude.back')" @close="emit('close')">
      <span class="now" :class="{ cold }">{{ fmt(nowTemp) }}</span>
    </ToolHeader>

    <!-- Cold-extrusion guard: explain + one-tap heat. -->
    <div v-if="cold" class="guard touch-card">
      <span class="guard-msg">{{ t('extrude.cold', { t: Math.round(minExtrude) }) }}</span>
      <button class="touch-btn-primary heat" type="button" :disabled="!canWrite" @click="heatUp">
        {{ t('extrude.heat') }}
      </button>
    </div>

    <!-- Distance + speed presets -->
    <div class="pick">
      <span class="pick-label">{{ t('extrude.distance') }}</span>
      <div class="pick-row">
        <button
          v-for="d in DISTANCES"
          :key="d"
          class="touch-btn opt"
          :class="{ on: distance === d }"
          type="button"
          :aria-pressed="distance === d"
          @click="distance = d"
        >
          {{ d }}
        </button>
      </div>
    </div>
    <div class="pick">
      <span class="pick-label">{{ t('extrude.speed') }}</span>
      <div class="pick-row">
        <button
          v-for="s in SPEEDS"
          :key="s"
          class="touch-btn opt"
          :class="{ on: speed === s }"
          type="button"
          :aria-pressed="speed === s"
          @click="speed = s"
        >
          {{ s }}
        </button>
      </div>
    </div>

    <!-- Actions: the pad takes the remaining height. -->
    <div class="acts">
      <button
        class="touch-btn act"
        type="button"
        :disabled="!canMove"
        :title="canMove ? '' : moveBlockedReason"
        @click="feedMove(1)"
      >
        <Icon name="arrow-down" size="1.3rem" /> {{ t('extrude.extrude') }}
      </button>
      <button class="touch-btn act" type="button" :disabled="!canMove" @click="feedMove(-1)">
        <Icon name="arrow-up" size="1.3rem" /> {{ t('extrude.retract') }}
      </button>
      <button
        v-if="loadMacro"
        class="touch-btn act aux"
        type="button"
        :disabled="!canMove"
        @click="runMacro(loadMacro)"
      >
        {{ t('extrude.load') }}
      </button>
      <button
        v-if="unloadMacro"
        class="touch-btn act aux"
        type="button"
        :disabled="!canMove"
        @click="runMacro(unloadMacro)"
      >
        {{ t('extrude.unload') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.extrude {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  height: 100%;
  min-height: 0;
}
.now {
  font-family: var(--font-mono);
  font-size: 1.2rem;
  color: var(--fm-primary);
}
.now.cold {
  color: var(--fm-warning);
}
.guard {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border-inline-start: 4px solid var(--fm-warning);
}
.guard-msg {
  flex: 1;
  color: var(--fm-text);
  font-size: 0.95rem;
}
.heat {
  min-height: var(--touch);
  padding: var(--sp-1) var(--sp-3);
}
.pick {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.pick-label {
  color: var(--fm-text-muted);
  font-size: var(--fs-caption);
  min-width: 4.5rem;
}
.pick-row {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-2);
}
.opt {
  min-height: var(--touch);
  padding: var(--sp-1) var(--sp-2);
}
.opt.on {
  background: var(--fm-primary);
  color: var(--fm-primary-contrast);
  border-color: transparent;
}
.acts {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: minmax(3.25rem, 1fr);
  gap: var(--sp-3);
}
.act {
  font-size: 1.15rem;
  font-weight: 700;
  min-height: 0;
}
.aux {
  font-weight: 600;
  color: var(--fm-secondary, var(--fm-text));
}
.touch-btn:disabled {
  opacity: 0.45;
}
</style>

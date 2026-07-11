<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/AppIcon.vue'
import ToolHeader from '@/components/ToolHeader.vue'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'

// The jog tool: relative XY/Z moves, per-axis + all homing, and disable-steppers - every write goes
// through the same gated control store as the rest of the app. Opened as an overlay from Status.
const { t } = useI18n()
const session = useSessionStore()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()

const emit = defineEmits<{ close: [] }>()

interface Toolhead {
  position?: number[]
  homed_axes?: string
}
const th = computed(() => session.object<Toolhead>('toolhead'))
const homed = computed(() => th.value?.homed_axes ?? '')
const pos = computed(() => th.value?.position ?? [])

const AXES = [
  { char: 'X', i: 0, dp: 1 },
  { char: 'Y', i: 1, dp: 1 },
  { char: 'Z', i: 2, dp: 2 },
] as const

function axisValue(i: number, char: string, dp: number): string {
  if (!homed.value.toLowerCase().includes(char.toLowerCase())) return '-'
  const v = pos.value[i]
  return v == null ? '-' : v.toFixed(dp)
}
const anyHomed = computed(() => homed.value.length > 0)

// Never jog / home / drop steppers INTO a running job: a G28 or jog fights the print and can crash
// the toolhead through the part. A paused print is a legitimate manual-move moment, so paused
// stays allowed - same rule the filament tool applies. (canWrite alone is true mid-print.)
const printing = computed(
  () => session.object<{ state?: string }>('print_stats')?.state === 'printing',
)
const canMove = computed(() => canWrite.value && !printing.value)
const moveBlockedReason = computed(() => (printing.value ? t('files.busy') : blockedReason.value))

const STEPS = [0.1, 1, 10, 100]
const step = ref(10)

// Relative move; G91/G90 are wrapped per-jog so we never leave the machine in relative mode. Z is
// fed slower than XY - a fast Z jog into the bed is how nozzles die.
function jog(axis: 'X' | 'Y' | 'Z', dir: 1 | -1): void {
  if (!canMove.value) return
  const feed = axis === 'Z' ? 600 : 6000
  const dist = (dir * step.value).toFixed(2)
  void ctl.runGcode(`G91\nG1 ${axis}${dist} F${feed}\nG90`)
}
function homeAxis(axis: 'X' | 'Y' | 'Z'): void {
  if (!canMove.value) return
  void ctl.runGcode(`G28 ${axis}`)
}
function disableMotors(): void {
  if (!canMove.value) return
  void ctl.runGcode('M84')
}
// Home-all routes through the same guard as every other motion write (not just the disabled
// attribute) so it can never fire mid-print.
function homeAll(): void {
  if (!canMove.value) return
  void ctl.home()
}
</script>

<template>
  <div class="move">
    <ToolHeader :title="t('move.title')" :back-label="t('move.back')" @close="emit('close')">
      <!-- Live position, inline so the pad gets the vertical room -->
      <span class="pos-axes" dir="ltr" :aria-label="t('move.position')">
        <span v-for="a in AXES" :key="a.char" class="pos-axis">
          <b>{{ a.char }}</b> {{ axisValue(a.i, a.char, a.dp) }}
        </span>
      </span>
    </ToolHeader>
    <p v-if="!anyHomed" class="pos-hint">{{ t('move.notHomed') }}</p>

    <!-- Step size (compact segmented row above the pad) -->
    <div class="steps">
      <span class="steps-label">{{ t('move.step') }}</span>
      <div class="steps-row">
        <button
          v-for="s in STEPS"
          :key="s"
          class="touch-btn step"
          :class="{ on: step === s }"
          type="button"
          :aria-pressed="step === s"
          @click="step = s"
        >
          {{ s }}
        </button>
      </div>
    </div>

    <!-- Pinned LTR: the pad maps PHYSICAL machine axes - in an RTL locale a mirrored grid would
         put X- on the right and jog the toolhead opposite to the tapped direction. -->
    <div class="pads" dir="ltr">
      <!-- XY jog pad -->
      <div class="xy">
        <button
          class="touch-btn jog up"
          type="button"
          :disabled="!canMove"
          :title="canMove ? '' : moveBlockedReason"
          @click="jog('Y', 1)"
        >
          Y+
        </button>
        <button class="touch-btn jog left" type="button" :disabled="!canMove" @click="jog('X', -1)">
          X−
        </button>
        <button
          class="touch-btn jog home"
          type="button"
          :disabled="!canMove"
          :aria-label="t('move.homeAll')"
          @click="homeAll()"
        >
          <Icon name="home" size="1.6rem" />
        </button>
        <button class="touch-btn jog right" type="button" :disabled="!canMove" @click="jog('X', 1)">
          X+
        </button>
        <button class="touch-btn jog down" type="button" :disabled="!canMove" @click="jog('Y', -1)">
          Y−
        </button>
      </div>

      <!-- Z jog -->
      <div class="z">
        <button class="touch-btn jog" type="button" :disabled="!canMove" @click="jog('Z', 1)">
          Z+
        </button>
        <button class="touch-btn jog" type="button" :disabled="!canMove" @click="jog('Z', -1)">
          Z−
        </button>
      </div>
    </div>

    <!-- Homing + disable -->
    <div class="home-row">
      <button
        v-for="a in AXES"
        :key="a.char"
        class="touch-btn"
        type="button"
        :disabled="!canMove"
        @click="homeAxis(a.char)"
      >
        {{ t('move.homeAxis', { axis: a.char }) }}
      </button>
      <button class="touch-btn disable" type="button" :disabled="!canMove" @click="disableMotors">
        {{ t('move.disable') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* No-scroll layout: fixed-height head/steps/home rows, the pads take ALL remaining height and the
   XY pad is sized by that height (a width-driven square would overflow vertically on every panel). */
.move {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  height: 100%;
  min-height: 0;
}
.pos-axes {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  gap: 1rem;
  font-family: var(--font-mono);
  font-size: 1rem;
  color: var(--fm-text);
}
.pos-axis b {
  color: var(--fm-text-muted);
  font-weight: 600;
  margin-inline-end: 0.2rem;
}
.pos-hint {
  margin: 0;
  color: var(--fm-warning);
  font-size: 0.8rem;
}
.pads {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  gap: var(--sp-4);
}
.xy {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: var(--sp-2);
  aspect-ratio: 1;
  height: 100%;
  max-width: 72%;
}
/* Pad buttons size from the grid tracks, not the global touch minimum - on a small panel the
   pad IS the touch budget, and a forced 4rem row would overflow it. */
.pads .jog {
  min-height: 0;
  padding: 0;
}
.jog {
  font-size: 1.2rem;
  font-weight: 600;
}
.up {
  grid-column: 2;
  grid-row: 1;
}
.left {
  grid-column: 1;
  grid-row: 2;
}
.home {
  grid-column: 2;
  grid-row: 2;
}
.right {
  grid-column: 3;
  grid-row: 2;
}
.down {
  grid-column: 2;
  grid-row: 3;
}
.z {
  display: grid;
  grid-template-rows: repeat(2, 1fr);
  gap: var(--sp-2);
  height: 100%;
  flex: 0 0 20%;
}
/* Compact segmented step selector - one slim row so the pad keeps the height. */
.steps {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.steps-label {
  color: var(--fm-text-muted);
  font-size: var(--fs-caption);
}
.steps-row {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-2);
}
.step {
  min-height: var(--touch);
  padding: var(--sp-1) var(--sp-2);
}
.step.on {
  background: var(--fm-primary);
  color: var(--fm-primary-contrast);
  border-color: transparent;
}
.home-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-2);
}
.home-row .touch-btn {
  min-height: 3.25rem;
  padding: var(--sp-1) var(--sp-2);
}
.disable {
  color: var(--fm-warning);
}
.touch-btn:disabled {
  opacity: 0.45;
}
</style>

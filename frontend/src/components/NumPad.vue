<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/AppIcon.vue'

// On-screen numeric entry for a keyboard-less printer panel. Renders as an in-view card (not a
// modal): the caller shows/hides it and receives the confirmed value; out-of-range entry is
// refused (the OK button disables) rather than clamped, with the valid range always visible.
// Decimal / negative entry are opt-in per caller (a temperature target has no use for either,
// an absolute Z offset needs both).
const props = withDefaults(
  defineProps<{
    /** Prompt shown above the value (e.g. the heater's name). */
    label: string
    min: number
    max: number
    unit?: string
    decimal?: boolean
    negative?: boolean
  }>(),
  { unit: undefined, decimal: false, negative: false },
)
const emit = defineEmits<{ confirm: [value: number]; close: [] }>()

const { t } = useI18n()
const raw = ref('')

// "-" and "12." are incomplete, not invalid - OK stays disabled until a number exists.
const value = computed(() => {
  if (raw.value === '' || raw.value === '-') return null
  const n = Number(raw.value)
  return Number.isFinite(n) ? n : null
})
const valid = computed(
  () => value.value != null && value.value >= props.min && value.value <= props.max,
)

/** Digits budget (sign and decimal point excluded): enough for any clamped range we expose. */
const MAX_DIGITS = 5

function press(d: string): void {
  const digits = raw.value.replace(/[-.]/g, '')
  if (digits.length >= MAX_DIGITS) return
  // Leading-zero normalization: a lone "0" is a valid entry (turn this heater off), but a
  // digit replaces it so "05"-style values can't occur ("0." stays reachable via the dot).
  if (raw.value === '0' || raw.value === '-0') {
    const sign = raw.value.startsWith('-') ? '-' : ''
    raw.value = d === '0' ? raw.value : sign + d
    return
  }
  raw.value += d
}
function pressDot(): void {
  if (!props.decimal || raw.value.includes('.')) return
  if (raw.value === '' || raw.value === '-') raw.value += '0.'
  else raw.value += '.'
}
function toggleSign(): void {
  if (!props.negative) return
  raw.value = raw.value.startsWith('-') ? raw.value.slice(1) : '-' + raw.value
}
function backspace(): void {
  raw.value = raw.value.slice(0, -1)
}
function confirm(): void {
  if (valid.value && value.value != null) emit('confirm', value.value)
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
</script>

<template>
  <div class="numpad touch-card" role="group" :aria-label="label">
    <div class="pad-head">
      <span class="pad-label">{{ label }}</span>
      <span class="pad-value" dir="ltr"
        >{{ raw || '·' }}<span v-if="unit" class="pad-unit">{{ unit }}</span></span
      >
      <span class="pad-range" dir="ltr">{{ t('temp.range', { min, max }) }}</span>
    </div>
    <div class="pad-grid" dir="ltr">
      <button v-for="d in DIGITS" :key="d" class="touch-btn key" type="button" @click="press(d)">
        {{ d }}
      </button>
      <!-- Extended bottom rows (decimal / signed callers): . 0 ± then backspace + wide OK. -->
      <template v-if="decimal || negative">
        <button class="touch-btn key" type="button" :disabled="!decimal" @click="pressDot">
          .
        </button>
        <button class="touch-btn key" type="button" @click="press('0')">0</button>
        <button
          class="touch-btn key"
          type="button"
          :disabled="!negative"
          :aria-label="t('temp.sign')"
          @click="toggleSign"
        >
          ±
        </button>
        <button
          class="touch-btn key"
          type="button"
          :aria-label="t('temp.backspace')"
          @click="backspace"
        >
          <Icon name="backspace" size="1.4rem" />
        </button>
        <button
          class="touch-btn-primary key ok span2"
          type="button"
          :disabled="!valid"
          :aria-label="t('temp.ok')"
          @click="confirm"
        >
          <Icon name="check" size="1.4rem" />
        </button>
      </template>
      <!-- Basic bottom row: backspace 0 OK. -->
      <template v-else>
        <button
          class="touch-btn key"
          type="button"
          :aria-label="t('temp.backspace')"
          @click="backspace"
        >
          <Icon name="backspace" size="1.4rem" />
        </button>
        <button class="touch-btn key" type="button" @click="press('0')">0</button>
        <button
          class="touch-btn-primary key ok"
          type="button"
          :disabled="!valid"
          :aria-label="t('temp.ok')"
          @click="confirm"
        >
          <Icon name="check" size="1.4rem" />
        </button>
      </template>
    </div>
    <button class="touch-btn cancel" type="button" @click="emit('close')">
      {{ t('temp.cancel') }}
    </button>
  </div>
</template>

<style scoped>
.numpad {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
}
.pad-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
}
.pad-label {
  color: var(--fm-text-muted);
  font-size: 0.95rem;
}
.pad-value {
  flex: 1;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 1.5rem;
  color: var(--fm-text);
}
.pad-unit {
  font-size: 0.9rem;
  color: var(--fm-text-muted);
  margin-inline-start: 0.15rem;
}
.pad-range {
  color: var(--fm-text-muted);
  font-size: 0.8rem;
}
.pad-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-2);
}
.span2 {
  grid-column: span 2;
}
.key {
  min-height: 3rem;
  padding: var(--sp-1);
  font-size: 1.15rem;
  font-weight: 600;
}
.key:disabled {
  opacity: 0.3;
}
.ok:disabled {
  opacity: 0.45;
}
.cancel {
  min-height: var(--touch);
  padding: var(--sp-1);
  font-size: 0.95rem;
}
</style>

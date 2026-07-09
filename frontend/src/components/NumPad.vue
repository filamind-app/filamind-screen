<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// On-screen numeric entry for a keyboard-less printer panel. Renders as an in-view card (not a
// modal): the caller shows/hides it and receives the confirmed value; out-of-range entry is
// refused (the OK button disables) rather than clamped, with the valid range always visible.
const props = defineProps<{
  /** Prompt shown above the value (e.g. the heater's name). */
  label: string
  min: number
  max: number
  unit?: string
}>()
const emit = defineEmits<{ confirm: [value: number]; close: [] }>()

const { t } = useI18n()
const raw = ref('')

const value = computed(() => (raw.value === '' ? null : Number(raw.value)))
const valid = computed(
  () => value.value != null && value.value >= props.min && value.value <= props.max,
)

function press(d: string): void {
  if (raw.value.length >= 4) return
  // Leading-zero normalization: a lone "0" is a valid entry (turn this heater off), but it is
  // replaced by the next digit so "05"-style values can't occur.
  if (raw.value === '0') {
    raw.value = d === '0' ? '0' : d
    return
  }
  raw.value += d
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
      <span class="pad-value"
        >{{ raw || '·' }}<span v-if="unit" class="pad-unit">{{ unit }}</span></span
      >
      <span class="pad-range">{{ t('temp.range', { min, max }) }}</span>
    </div>
    <div class="pad-grid">
      <button v-for="d in DIGITS" :key="d" class="touch-btn key" type="button" @click="press(d)">
        {{ d }}
      </button>
      <button
        class="touch-btn key"
        type="button"
        :aria-label="t('temp.backspace')"
        @click="backspace"
      >
        ⌫
      </button>
      <button class="touch-btn key" type="button" @click="press('0')">0</button>
      <button class="touch-btn-primary key ok" type="button" :disabled="!valid" @click="confirm">
        ✓
      </button>
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
  gap: 0.6rem;
  padding: 0.9rem;
}
.pad-head {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
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
  gap: 0.5rem;
}
.key {
  min-height: 3rem;
  padding: 0.2rem;
  font-size: 1.15rem;
  font-weight: 600;
}
.ok:disabled {
  opacity: 0.45;
}
.cancel {
  min-height: 2.75rem;
  padding: 0.3rem;
  font-size: 0.95rem;
}
</style>

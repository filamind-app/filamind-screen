<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'

const { t } = useI18n()
const session = useSessionStore()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()

// Jump to the tools that do the actual daily work (the shell routes these).
const emit = defineEmits<{ navigate: [to: 'temp' | 'filament' | 'move'] }>()

interface PrintStats {
  state?: string
}
const printState = computed(() => session.object<PrintStats>('print_stats')?.state ?? 'standby')
const isPrinting = computed(() => printState.value === 'printing')
const isPaused = computed(() => printState.value === 'paused')

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
</script>

<template>
  <div class="control">
    <div class="grid">
      <button
        class="touch-btn"
        type="button"
        :disabled="!canWrite"
        :title="canWrite ? '' : blockedReason"
        @click="ctl.home()"
      >
        🏠 {{ t('control.home') }}
      </button>
      <button
        v-if="isPrinting"
        class="touch-btn"
        type="button"
        :disabled="!canWrite"
        @click="ctl.pause()"
      >
        ⏸ {{ t('control.pause') }}
      </button>
      <button
        v-if="isPaused"
        class="touch-btn"
        type="button"
        :disabled="!canWrite"
        @click="ctl.resume()"
      >
        ▶ {{ t('control.resume') }}
      </button>
      <button
        v-if="isPrinting || isPaused"
        class="touch-btn"
        :class="{ warning: confirmingCancel }"
        type="button"
        :disabled="!canWrite"
        @click="onCancel"
      >
        ⏹ {{ confirmingCancel ? t('control.cancelConfirm') : t('control.cancel') }}
      </button>
      <button
        v-if="!isPrinting && !isPaused"
        class="touch-btn"
        type="button"
        @click="emit('navigate', 'temp')"
      >
        🌡 {{ t('status.temp') }}
      </button>
      <button
        v-if="!isPrinting && !isPaused"
        class="touch-btn"
        type="button"
        @click="emit('navigate', 'filament')"
      >
        🧵 {{ t('status.filament') }}
      </button>
      <button
        v-if="!isPrinting && !isPaused"
        class="touch-btn"
        type="button"
        @click="emit('navigate', 'move')"
      >
        ✥ {{ t('status.move') }}
      </button>
    </div>

    <div class="grid">
      <button
        class="touch-btn safe"
        :class="{ on: ctl.safeMode }"
        type="button"
        :aria-pressed="ctl.safeMode"
        @click="ctl.toggleSafeMode()"
      >
        🛡 {{ ctl.safeMode ? t('control.safeOn') : t('control.safeOff') }}
      </button>
      <button class="touch-btn estop" type="button" @click="ctl.emergencyStop()">
        ⛔ {{ t('control.estop') }}
      </button>
    </div>

    <p v-if="ctl.lastError" class="err" role="alert">{{ t('control.error.' + ctl.lastError) }}</p>
  </div>
</template>

<style scoped>
.control {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
/* Each row of controls grows to fill the panel so the buttons are big and the view never scrolls. */
.grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 1fr;
  gap: 1rem;
}
.touch-btn:disabled {
  opacity: 0.45;
}
.warning {
  border-color: var(--fm-warning);
  color: var(--fm-warning);
}
.safe.on {
  border-color: var(--fm-warning);
  color: var(--fm-warning);
}
.estop {
  background: var(--fm-danger);
  color: #fff;
  border-color: transparent;
  font-weight: 700;
}
.err {
  margin: 0;
  color: var(--fm-danger);
}
</style>

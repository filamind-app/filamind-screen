<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { asleep, wake } from '@/core/idle'

// The sleep overlay: a black shield above everything. The waking tap is SWALLOWED and the
// shield keeps blocking input for a short beat afterwards, so a ghost touch (or an eager
// double-tap) can't press whatever control happens to sit underneath.
const { t } = useI18n()
const waking = ref(false)

function onTap(): void {
  if (waking.value) return
  waking.value = true
  window.setTimeout(() => {
    wake()
    waking.value = false
  }, 350)
}
</script>

<template>
  <div
    v-if="asleep"
    class="shield"
    :class="{ waking }"
    role="button"
    :aria-label="t('shell.wake')"
    @pointerdown.prevent.stop="onTap"
  ></div>
</template>

<style scoped>
.shield {
  position: fixed;
  inset: 0;
  z-index: 200; /* above prompts, toasts and the keyboard - asleep means asleep */
  background: #000;
  opacity: 1;
  transition: opacity 0.35s ease;
  cursor: pointer;
}
.shield.waking {
  opacity: 0; /* fades out while still swallowing input (the ghost-touch guard) */
}
</style>

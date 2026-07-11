<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import TouchShell from '@/components/TouchShell.vue'
import { useSessionStore } from '@/core/store/session'

const sessionStore = useSessionStore()

// A kiosk panel usually powers on BEFORE Moonraker/Klipper is ready, so the first connect can fail;
// without a retry the session would sit Offline forever with every write refused. Retry on a capped
// exponential backoff until it connects (store.start() resets its own guard on each failure).
let retryTimer: ReturnType<typeof setTimeout> | undefined
async function connectWithRetry(attempt = 0): Promise<void> {
  try {
    await sessionStore.start()
  } catch (e) {
    console.error('session start failed', e)
    const delay = Math.min(30_000, 2_000 * 2 ** attempt)
    retryTimer = setTimeout(() => void connectWithRetry(attempt + 1), delay)
  }
}
onMounted(() => void connectWithRetry())
onUnmounted(() => {
  if (retryTimer) clearTimeout(retryTimer)
})
</script>

<template>
  <TouchShell />
</template>

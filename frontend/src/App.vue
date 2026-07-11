<script setup lang="ts">
import { onMounted } from 'vue'
import TouchShell from '@/components/TouchShell.vue'
import { useSessionStore } from '@/core/store/session'

const sessionStore = useSessionStore()
onMounted(() => {
  sessionStore.start().catch((e) => console.error('session start failed', e))
  // TEMP diagnostic: surface the live direction values in the window title (read via xwininfo).
  window.setInterval(() => {
    const dir = (sel: string): string => {
      const el = sel === 'html' ? document.documentElement : document.querySelector(sel)
      return el ? getComputedStyle(el).direction : '?'
    }
    document.title =
      `FM attr=${document.documentElement.getAttribute('dir')} ` +
      `html=${dir('html')} body=${dir('body')} shell=${dir('.shell')} bodyflex=${dir('.body')}`
  }, 2000)
})
</script>

<template>
  <TouchShell />
</template>

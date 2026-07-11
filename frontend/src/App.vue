<script setup lang="ts">
import { onMounted, ref } from 'vue'
import TouchShell from '@/components/TouchShell.vue'
import { useSessionStore } from '@/core/store/session'

const sessionStore = useSessionStore()
const diag = ref('')
onMounted(() => {
  sessionStore.start().catch((e) => console.error('session start failed', e))
  // TEMP diagnostic: render the live direction values as a visible overlay (read via screenshot).
  window.setInterval(() => {
    const dir = (sel: string): string => {
      const el = sel === 'html' ? document.documentElement : document.querySelector(sel)
      return el ? getComputedStyle(el).direction : '?'
    }
    diag.value =
      `attr=${document.documentElement.getAttribute('dir')} ` +
      `inline=${document.documentElement.style.direction || '-'} ` +
      `html=${dir('html')} body=${dir('body')} shell=${dir('.shell')} flex=${dir('.body')}`
  }, 1500)
})
</script>

<template>
  <TouchShell />
  <div
    style="
      position: fixed;
      top: 0;
      left: 0;
      z-index: 99999;
      background: #ff0;
      color: #000;
      font: 12px monospace;
      padding: 3px 6px;
      direction: ltr;
      unicode-bidi: isolate;
    "
  >
    {{ diag }}
  </div>
</template>

<script setup lang="ts">
// The one tool-screen header: direction-aware back, the tool's title, and an optional trailing
// slot (refresh, live value...). One implementation instead of seven drifting copies.
import Icon from '@/components/AppIcon.vue'

defineProps<{ title: string; backLabel: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <header class="tool-head">
    <button class="back touch-btn" type="button" :aria-label="backLabel" @click="emit('close')">
      <Icon name="back" size="1.4rem" />
    </button>
    <h2 class="tool-title">{{ title }}</h2>
    <div class="trail"><slot /></div>
  </header>
</template>

<style scoped>
.tool-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.back {
  min-width: var(--touch);
  min-height: var(--touch);
  padding: 0;
}
.tool-title {
  margin: 0;
  flex: 1;
  font-family: var(--font-display, system-ui);
  font-size: var(--fs-title);
  color: var(--fm-text);
}
.trail {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
</style>

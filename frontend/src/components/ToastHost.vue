<script setup lang="ts">
import { toasts, dismiss } from '@/core/toast'
import Icon from '@/components/AppIcon.vue'
</script>

<template>
  <!-- Floats above everything, bottom-centered clear of the content; taps dismiss. -->
  <div class="host" aria-live="polite">
    <button
      v-for="t in toasts"
      :key="t.id"
      class="toast"
      :class="t.level"
      type="button"
      @click="dismiss(t.id)"
    >
      <Icon v-if="t.level !== 'info'" name="warning" size="1.2rem" />
      <span class="toast-text">{{ t.text }}</span>
    </button>
  </div>
</template>

<style scoped>
.host {
  position: fixed;
  inset-inline: 0;
  bottom: var(--sp-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  z-index: 80;
  pointer-events: none;
}
/* While the keyboard is docked, float toasts above it so they never cover (or intercept taps
   meant for) the space/enter row. */
:global(html.osk-docked) .host {
  bottom: calc(var(--osk-h) + var(--sp-2));
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  max-width: min(36rem, 92vw);
  min-height: var(--touch);
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--r-pill);
  border: 1px solid var(--fm-border);
  background: var(--fm-surface-2);
  color: var(--fm-text);
  font-size: var(--fs-body);
  box-shadow: 0 0.4rem 1.2rem rgba(0, 0, 0, 0.35);
  cursor: pointer;
  text-align: start;
}
.toast.warn {
  border-color: var(--fm-warning);
  color: var(--fm-warning);
}
.toast.error {
  border-color: var(--fm-danger);
  color: var(--fm-danger);
}
.toast-text {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>

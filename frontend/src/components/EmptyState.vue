<script setup lang="ts">
// Empty states as guidance, not a muted one-liner: an icon, what this screen would show, and an
// optional action slot (retry, open settings...).
import Icon, { type IconName } from '@/components/AppIcon.vue'

defineProps<{ icon: IconName; text: string }>()
</script>

<template>
  <div class="empty">
    <span class="empty-icon"><Icon :name="icon" size="2.6rem" /></span>
    <p class="empty-text">{{ text }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  padding: var(--sp-6);
  text-align: center;
}
.empty-icon {
  color: var(--fm-text-muted);
  opacity: 0.7;
}
.empty-text {
  margin: 0;
  max-width: 26rem;
  color: var(--fm-text-muted);
  font-size: var(--fs-body);
}
</style>

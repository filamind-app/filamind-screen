<script setup lang="ts">
// Line-style tab glyphs drawn with currentColor so they inherit the active/idle tab colour (the
// theme's gold accent on the selected tab, muted otherwise) instead of fixed-colour emoji.
defineProps<{ name: string }>()
</script>

<template>
  <svg
    class="tab-svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Status: a gauge -->
    <template v-if="name === 'status'">
      <path d="M4 18 a8 8 0 0 1 16 0" />
      <line x1="12" y1="18" x2="15.5" y2="13" />
    </template>
    <!-- Control: two sliders -->
    <template v-else-if="name === 'control'">
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="9" cy="8" r="2.2" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="15" cy="16" r="2.2" />
    </template>
    <!-- Settings: a gear -->
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3.2" />
      <line x1="12" y1="3.5" x2="12" y2="7" />
      <line x1="12" y1="17" x2="12" y2="20.5" />
      <line x1="3.5" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="20.5" y2="12" />
      <line x1="6" y1="6" x2="8.5" y2="8.5" />
      <line x1="15.5" y1="15.5" x2="18" y2="18" />
      <line x1="18" y1="6" x2="15.5" y2="8.5" />
      <line x1="8.5" y1="15.5" x2="6" y2="18" />
    </template>
  </svg>
</template>

<style scoped>
.tab-svg {
  width: 1.6rem;
  height: 1.6rem;
}
</style>

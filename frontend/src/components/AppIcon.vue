<script setup lang="ts">
// The app's single line-icon set, drawn with currentColor so every glyph recolors with the theme
// (emoji don't: they render as fixed-color or tofu on embedded kiosk fonts). Sized in rem via the
// optional `size` so icons scale with the uniform canvas like everything else.
export type IconName =
  | 'status'
  | 'heat'
  | 'filament'
  | 'move'
  | 'tune'
  | 'files'
  | 'console'
  | 'macros'
  | 'settings'
  | 'back'
  | 'up'
  | 'arrow-up'
  | 'arrow-down'
  | 'refresh'
  | 'home'
  | 'pause'
  | 'play'
  | 'stop'
  | 'check'
  | 'backspace'
  | 'close'
  | 'warning'
  | 'folder'
  | 'doc'
  | 'fan'
  | 'power'
  | 'motor-off'
  | 'shield'
  | 'estop'

withDefaults(defineProps<{ name: IconName; size?: string }>(), { size: '1.5rem' })
</script>

<template>
  <svg
    class="icon"
    :class="{ 'rtl-mirror': name === 'back' }"
    :style="{ width: size, height: size }"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- status: gauge -->
    <template v-if="name === 'status'">
      <path d="M4 18 a8 8 0 0 1 16 0" />
      <line x1="12" y1="18" x2="15.5" y2="13" />
    </template>
    <!-- heat: thermometer -->
    <template v-else-if="name === 'heat'">
      <path d="M10 4 a2 2 0 0 1 4 0 v9.5 a4 4 0 1 1 -4 0 Z" />
      <circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none" />
    </template>
    <!-- filament: spool -->
    <template v-else-if="name === 'filament'">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M18.5 17.5 22 21" />
    </template>
    <!-- move: cross arrows -->
    <template v-else-if="name === 'move'">
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M9 5.5 12 3 l3 2.5 M9 18.5 12 21 l3 -2.5 M5.5 9 3 12 l2.5 3 M18.5 9 21 12 l-2.5 3" />
    </template>
    <!-- tune: sliders -->
    <template v-else-if="name === 'tune'">
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="9" cy="8" r="2.2" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="15" cy="16" r="2.2" />
    </template>
    <!-- files: folder -->
    <template v-else-if="name === 'files'">
      <path
        d="M3.5 7 v11 a1.5 1.5 0 0 0 1.5 1.5 h14 a1.5 1.5 0 0 0 1.5 -1.5 V9.5 A1.5 1.5 0 0 0 19 8 h-7.5 L9.5 5.5 H5 A1.5 1.5 0 0 0 3.5 7 Z"
      />
    </template>
    <!-- console: terminal -->
    <template v-else-if="name === 'console'">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M7 10 l3 2.5 -3 2.5" />
      <line x1="12.5" y1="15" x2="17" y2="15" />
    </template>
    <!-- macros: command grid -->
    <template v-else-if="name === 'macros'">
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <path d="M16.5 13.5 v6 M13.5 16.5 h6" />
    </template>
    <!-- settings: gear -->
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
    <!-- back: chevron (mirrored by the RTL rule below) -->
    <template v-else-if="name === 'back'">
      <path d="M14.5 5.5 8 12 l6.5 6.5" />
    </template>
    <!-- up: folder-up chevron -->
    <template v-else-if="name === 'up'">
      <path d="M5.5 14.5 12 8 l6.5 6.5" />
    </template>
    <!-- arrow-up: full arrow (retract) -->
    <template v-else-if="name === 'arrow-up'">
      <line x1="12" y1="20" x2="12" y2="5" />
      <path d="M6.5 10.5 12 5 l5.5 5.5" />
    </template>
    <!-- arrow-down: full arrow (extrude) -->
    <template v-else-if="name === 'arrow-down'">
      <line x1="12" y1="4" x2="12" y2="19" />
      <path d="M6.5 13.5 12 19 l5.5 -5.5" />
    </template>
    <!-- refresh -->
    <template v-else-if="name === 'refresh'">
      <path d="M19.5 12 a7.5 7.5 0 1 1 -2.2 -5.3" />
      <path d="M19.5 3.5 v3.7 h-3.7" />
    </template>
    <!-- home -->
    <template v-else-if="name === 'home'">
      <path d="M4 11.5 12 4.5 l8 7" />
      <path d="M6.5 10 v9 h4 v-5 h3 v5 h4 v-9" />
    </template>
    <!-- pause -->
    <template v-else-if="name === 'pause'">
      <line x1="9" y1="5.5" x2="9" y2="18.5" />
      <line x1="15" y1="5.5" x2="15" y2="18.5" />
    </template>
    <!-- play -->
    <template v-else-if="name === 'play'">
      <path d="M8 5.5 v13 L18.5 12 Z" />
    </template>
    <!-- stop -->
    <template v-else-if="name === 'stop'">
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
    </template>
    <!-- check -->
    <template v-else-if="name === 'check'">
      <path d="M5 12.5 10 17.5 19 7" />
    </template>
    <!-- backspace -->
    <template v-else-if="name === 'backspace'">
      <path d="M8.5 5.5 h11 a1.5 1.5 0 0 1 1.5 1.5 v10 a1.5 1.5 0 0 1 -1.5 1.5 h-11 L3 12 Z" />
      <path d="M11.5 9.5 16.5 14.5 M16.5 9.5 11.5 14.5" />
    </template>
    <!-- close -->
    <template v-else-if="name === 'close'">
      <path d="M6 6 18 18 M18 6 6 18" />
    </template>
    <!-- warning -->
    <template v-else-if="name === 'warning'">
      <path d="M12 4 21 19.5 H3 Z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="16.8" r="0.4" fill="currentColor" stroke="none" />
    </template>
    <!-- folder -->
    <template v-else-if="name === 'folder'">
      <path
        d="M3.5 7 v11 a1.5 1.5 0 0 0 1.5 1.5 h14 a1.5 1.5 0 0 0 1.5 -1.5 V9.5 A1.5 1.5 0 0 0 19 8 h-7.5 L9.5 5.5 H5 A1.5 1.5 0 0 0 3.5 7 Z"
      />
    </template>
    <!-- doc: file -->
    <template v-else-if="name === 'doc'">
      <path
        d="M6.5 3.5 h7 L18.5 8.5 v11 a1.5 1.5 0 0 1 -1.5 1.5 H6.5 A1.5 1.5 0 0 1 5 19.5 v-14 A1.5 1.5 0 0 1 6.5 3.5 Z"
      />
      <path d="M13.5 3.5 v5 h5" />
    </template>
    <!-- fan -->
    <template v-else-if="name === 'fan'">
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10 C12 5.5 15 4 17 5 c1.5 1 .5 4 -3.5 5.7" />
      <path d="M10 12 C5.5 12 4 9 5 7 c1 -1.5 4 -.5 5.7 3.5" />
      <path d="M12 14 C12 18.5 9 20 7 19 c-1.5 -1 -.5 -4 3.5 -5.7" />
      <path d="M14 12 C18.5 12 20 15 19 17 c-1 1.5 -4 .5 -5.7 -3.5" />
    </template>
    <!-- power -->
    <template v-else-if="name === 'power'">
      <path d="M12 3.5 v8" />
      <path d="M7 6.5 a7.5 7.5 0 1 0 10 0" />
    </template>
    <!-- motor-off: crossed M -->
    <template v-else-if="name === 'motor-off'">
      <path d="M5 19 V7 l3.5 5 L12 7 l3.5 5 L19 7 v12" opacity="0.9" />
      <line x1="4" y1="4" x2="20" y2="20" />
    </template>
    <!-- shield: safe mode -->
    <template v-else-if="name === 'shield'">
      <path d="M12 3.5 19 6 v6 c0 4.5 -3 7.5 -7 8.5 -4 -1 -7 -4 -7 -8.5 V6 Z" />
    </template>
    <!-- estop: octagon + bar -->
    <template v-else-if="name === 'estop'">
      <path d="M8.2 3.5 h7.6 L21 8.2 v7.6 L15.8 20.5 H8.2 L3 15.8 V8.2 Z" />
      <line x1="8.5" y1="12" x2="15.5" y2="12" />
    </template>
  </svg>
</template>

<style scoped>
.icon {
  flex-shrink: 0;
}
/* The RTL mirror of the back chevron lives in main.css, NOT here: a scoped `:global([dir='rtl'])
   … ` selector was collapsed by the CSS minifier to a bare `[dir=rtl] { transform: scaleX(-1) }`,
   which mirrored the ENTIRE page (dir=rtl is on <html>) and made Arabic look reversed. */
</style>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { themes, type ThemeName } from '@filamind-app/core'
import { useSettingsStore } from '@/core/store/settings'
import { shippedLocales, setLocale } from '@/core/i18n'

const { t, locale } = useI18n()
const settings = useSettingsStore()
const themeNames = Object.keys(themes) as ThemeName[]

async function chooseLocale(code: string): Promise<void> {
  await setLocale(code)
  settings.patch({ locale: code })
}

// Display options the settings model already carries (theme.ts applies them to the DOM).
const DENSITIES = ['comfortable', 'compact'] as const
const MOTIFS = ['off', 'subtle', 'full'] as const

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
</script>

<template>
  <div class="settings">
    <section class="block touch-card">
      <h2 class="block-title">{{ t('settings.theme') }}</h2>
      <div class="themes">
        <button
          v-for="n in themeNames"
          :key="n"
          class="swatch"
          :class="{ sel: settings.state.theme === n }"
          type="button"
          :aria-pressed="settings.state.theme === n"
          @click="settings.patch({ theme: n })"
        >
          <span class="dots">
            <span :style="{ background: themes[n].primary }"></span>
            <span :style="{ background: themes[n].secondary }"></span>
            <span :style="{ background: themes[n].accent }"></span>
          </span>
          <span class="sw-name">{{ t('settings.themeName.' + n) }}</span>
        </button>
      </div>
    </section>

    <section class="block touch-card">
      <h2 class="block-title">{{ t('settings.language') }}</h2>
      <select
        class="lang-select"
        :value="locale"
        :aria-label="t('settings.language')"
        @change="chooseLocale(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="l in shippedLocales" :key="l.code" :value="l.code">{{ l.name }}</option>
      </select>
    </section>

    <section class="block touch-card">
      <h2 class="block-title">{{ t('settings.display') }}</h2>
      <div class="opt-row">
        <span class="opt-label">{{ t('settings.density') }}</span>
        <div class="seg">
          <button
            v-for="d in DENSITIES"
            :key="d"
            class="seg-btn"
            :class="{ on: settings.state.density === d }"
            type="button"
            :aria-pressed="settings.state.density === d"
            @click="settings.patch({ density: d })"
          >
            {{ t('settings.densityName.' + d) }}
          </button>
        </div>
      </div>
      <div class="opt-row">
        <span class="opt-label">{{ t('settings.motifs') }}</span>
        <div class="seg">
          <button
            v-for="m in MOTIFS"
            :key="m"
            class="seg-btn"
            :class="{ on: settings.state.motifDensity === m }"
            type="button"
            :aria-pressed="settings.state.motifDensity === m"
            @click="settings.patch({ motifDensity: m })"
          >
            {{ t('settings.motifName.' + m) }}
          </button>
        </div>
      </div>
      <div class="opt-row">
        <span class="opt-label">{{ t('settings.reducedMotion') }}</span>
        <div class="seg">
          <button
            class="seg-btn"
            :class="{ on: !settings.state.reducedMotion }"
            type="button"
            :aria-pressed="!settings.state.reducedMotion"
            @click="settings.patch({ reducedMotion: false })"
          >
            {{ t('settings.motionOn') }}
          </button>
          <button
            class="seg-btn"
            :class="{ on: settings.state.reducedMotion }"
            type="button"
            :aria-pressed="settings.state.reducedMotion"
            @click="settings.patch({ reducedMotion: true })"
          >
            {{ t('settings.motionReduced') }}
          </button>
        </div>
      </div>
    </section>

    <section class="block touch-card about">
      <span class="opt-label">{{ t('settings.version') }}</span>
      <span class="version">v{{ appVersion }}</span>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow-y: auto; /* settings grow over time - the list scrolls, the shell chrome doesn't */
}
.block {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.block-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--fm-text);
}
.themes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(8rem, 100%), 1fr));
  gap: 0.75rem;
}
.swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem;
  border-radius: 1rem;
  background: var(--fm-surface-2);
  border: 3px solid var(--fm-border);
  cursor: pointer;
}
.swatch.sel {
  border-color: var(--fm-primary);
}
.dots {
  display: flex;
  gap: 0.4rem;
}
.dots span {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 999px;
}
.sw-name {
  font-size: 0.95rem;
  color: var(--fm-text);
}
.lang-select {
  width: 100%;
  min-height: 3.5rem;
  padding: 0 1rem;
  border-radius: 1rem;
  background: var(--fm-surface-2);
  color: var(--fm-text);
  border: 1px solid var(--fm-border);
  font-size: 1.05rem;
}
.opt-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.opt-label {
  flex: 1;
  color: var(--fm-text);
  font-size: 1rem;
}
.seg {
  display: flex;
  gap: 0.35rem;
}
.seg-btn {
  min-height: 2.75rem;
  padding: 0.25rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--fm-border);
  background: var(--fm-surface-2);
  color: var(--fm-text-muted);
  font-size: 0.9rem;
  cursor: pointer;
}
.seg-btn.on {
  background: var(--fm-primary);
  color: var(--fm-primary-contrast);
  border-color: transparent;
}
.about {
  flex-direction: row;
  align-items: center;
}
.version {
  font-family: var(--font-mono);
  color: var(--fm-text-muted);
}
</style>

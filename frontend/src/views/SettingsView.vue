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
      <div class="langs">
        <button
          v-for="l in shippedLocales"
          :key="l.code"
          class="touch-btn lang"
          :class="{ sel: locale === l.code }"
          type="button"
          @click="chooseLocale(l.code)"
        >
          {{ l.name }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem;
  border-radius: 16px;
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
.langs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}
.lang.sel {
  border-color: var(--fm-primary);
  color: var(--fm-primary);
}
</style>

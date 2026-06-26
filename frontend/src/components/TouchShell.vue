<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import TrustRibbon from '@/components/TrustRibbon.vue'
import TabIcon from '@/components/TabIcon.vue'
import PromptDialog from '@/components/PromptDialog.vue'
import StatusView from '@/views/StatusView.vue'
import ControlView from '@/views/ControlView.vue'
import SettingsView from '@/views/SettingsView.vue'
import MoveView from '@/views/MoveView.vue'
import TuneView from '@/views/TuneView.vue'
import FilesView from '@/views/FilesView.vue'
import ConsoleView from '@/views/ConsoleView.vue'
import { remoteNav, remoteBanner, remoteLocating, dismissBanner } from '@/core/remote'
import { useControlStore } from '@/core/store/control'
import { connector } from '@/core/session'

const { t } = useI18n()
const ctl = useControlStore()

// Show which printer this panel drives: its Moonraker hostname. Falls back to the product name until
// the host answers (and if it never does, e.g. a cold boot before Klipper is up).
const printerName = ref('')
onMounted(async () => {
  try {
    const info = await connector.call<{ hostname?: string }>('printer.info')
    printerName.value = info?.hostname ?? ''
  } catch {
    printerName.value = ''
  }
})
const brandName = computed(() => printerName.value || 'FilaMind')

type Tab = 'status' | 'control' | 'settings'
// Tools are full-screen overlays launched from a tab (e.g. Status' action bar), not bottom-nav tabs.
// Kept separate from `tab` so the bottom nav stays a clean 3-way and its roving tabindex is intact.
type Tool = 'move' | 'tune' | 'files' | 'console'
const TOOLS: readonly Tool[] = ['move', 'tune', 'files', 'console']
const tab = ref<Tab>('status')
const tool = ref<Tool | null>(null)

// A remote-control "navigate" command from another surface switches the active tab (and drops any
// open tool — the remote asked for a specific tab).
watch(remoteNav, (r) => {
  if (r) {
    tool.value = null
    tab.value = r.view
  }
})
const tabs: { id: Tab }[] = [{ id: 'status' }, { id: 'control' }, { id: 'settings' }]
const views: Record<Tab, Component> = {
  status: StatusView,
  control: ControlView,
  settings: SettingsView,
}
const toolViews: Record<Tool, Component> = {
  move: MoveView,
  tune: TuneView,
  files: FilesView,
  console: ConsoleView,
}
// The tool overlay takes over the content area when open; otherwise the active tab's view shows.
const active = computed<Component>(() => (tool.value ? toolViews[tool.value] : views[tab.value]))

// A view (e.g. the Status action bar's Move / Tune) asks the shell to switch tab OR open a tool.
function onNavigate(to: Tab | Tool): void {
  if ((TOOLS as readonly string[]).includes(to)) {
    tool.value = to as Tool
    return
  }
  tool.value = null
  tab.value = to as Tab
}
function selectTab(id: Tab): void {
  tool.value = null
  tab.value = id
}

// WAI-ARIA tabs keyboard support: arrows + Home/End move + focus the tab.
function onTabKey(e: KeyboardEvent): void {
  const i = tabs.findIndex((tb) => tb.id === tab.value)
  let next = i
  if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
  else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = tabs.length - 1
  else return
  e.preventDefault()
  const target = tabs[next]
  if (!target) return
  selectTab(target.id)
  void nextTick().then(() => document.getElementById(`tab-${target.id}`)?.focus())
}

// Dismissing the banner removes it from the DOM; move focus to the active tab so a keyboard/AT
// user keeps their place instead of dropping to <body> (WCAG 2.4.3).
function onDismissBanner(): void {
  dismissBanner()
  void nextTick().then(() => document.getElementById(`tab-${tab.value}`)?.focus())
}
</script>

<template>
  <div class="shell" :class="{ locating: remoteLocating }">
    <header class="bar">
      <div class="brand">
        <img src="/favicon.svg" width="26" height="26" alt="" />
        <span class="brand-name" :title="brandName">{{ brandName }}</span>
      </div>
      <div class="bar-right">
        <TrustRibbon />
        <!-- E-STOP is reachable from every tab, not just Control; ungated like the in-tab one. -->
        <button
          class="estop-mini"
          type="button"
          :aria-label="t('control.estop')"
          :title="t('control.estop')"
          @click="ctl.emergencyStop()"
        >
          <span aria-hidden="true">⛔</span>
          <span class="estop-label">{{ t('control.estop') }}</span>
        </button>
      </div>
    </header>

    <!-- Always mounted (v-show) so the aria-live region pre-exists and the first message is announced. -->
    <div
      v-show="remoteBanner"
      class="remote-banner"
      :class="remoteBanner?.level"
      :role="remoteBanner?.level === 'warn' ? 'alert' : 'status'"
      :aria-live="remoteBanner?.level === 'warn' ? 'assertive' : 'polite'"
    >
      <template v-if="remoteBanner">
        <span v-if="remoteBanner.level === 'warn'" class="remote-icon" aria-hidden="true">⚠</span>
        <span v-if="remoteBanner.level === 'warn'" class="sr-only">{{
          t('shell.remote.warning')
        }}</span>
        <span class="remote-msg">{{ remoteBanner.text }}</span>
        <button
          type="button"
          class="remote-dismiss"
          :aria-label="t('shell.remote.dismiss')"
          @click="onDismissBanner"
        >
          ✕
        </button>
      </template>
    </div>

    <main
      :id="`panel-${tab}`"
      class="content"
      role="tabpanel"
      :aria-labelledby="`tab-${tab}`"
      tabindex="0"
    >
      <component :is="active" @navigate="onNavigate" @close="tool = null" />
    </main>

    <nav class="tabs" role="tablist" :aria-label="t('shell.nav')" @keydown="onTabKey">
      <button
        v-for="tb in tabs"
        :id="`tab-${tb.id}`"
        :key="tb.id"
        class="tab"
        :class="{ active: tab === tb.id }"
        type="button"
        role="tab"
        :aria-selected="tab === tb.id"
        :aria-controls="`panel-${tb.id}`"
        :tabindex="tab === tb.id ? 0 : -1"
        @click="selectTab(tb.id)"
      >
        <TabIcon :name="tb.id" class="tab-icon" />
        <span class="tab-label">{{ t('shell.tab.' + tb.id) }}</span>
      </button>
    </nav>

    <div v-show="remoteLocating" class="locate-badge" role="status" aria-live="polite">
      <span aria-hidden="true">📍</span> {{ t('shell.remote.here') }}
    </div>

    <PromptDialog />
  </div>
</template>

<style scoped>
.shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid var(--fm-border);
  background: var(--fm-surface);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-display);
}
.brand-name {
  color: var(--fm-text);
  font-size: 1.15rem;
  letter-spacing: 0.5px;
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
/* Always-present emergency stop (every tab); ungated. */
.estop-mini {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0 0.85rem;
  border: 0;
  border-radius: 12px;
  background: var(--fm-danger);
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
}
.estop-mini:active {
  filter: brightness(0.9);
}
.content {
  flex: 1;
  padding: 1.25rem;
  overflow: auto;
}
.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.6rem;
  border-top: 1px solid var(--fm-border);
  background: var(--fm-surface);
}
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-height: 68px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--fm-text-muted);
  cursor: pointer;
}
.tab.active {
  background: var(--fm-surface-2);
  color: var(--fm-primary);
}
.tab-icon {
  font-size: 1.5rem;
}
.tab-label {
  font-size: 0.95rem;
}

/* Remote-control message banner (pushed from another surface). */
.remote-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  background: var(--fm-surface-2);
  border-bottom: 1px solid var(--fm-border);
  border-inline-start: 4px solid var(--fm-primary);
}
.remote-banner.warn {
  border-inline-start-color: var(--fm-warning);
}
.remote-icon {
  font-size: 1.1rem;
}
.remote-msg {
  flex: 1;
  color: var(--fm-text);
  font-size: 1rem;
}
/* Visually-hidden but available to assistive tech. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.remote-dismiss {
  border: 0;
  background: transparent;
  color: var(--fm-text-muted);
  font-size: 1.1rem;
  min-width: 44px;
  min-height: 44px;
  cursor: pointer;
}

/* "Locate" flash so an operator can tell which physical screen is FilaMind. */
.shell.locating {
  animation: locate-pulse 1s ease-in-out infinite;
}
@keyframes locate-pulse {
  0%,
  100% {
    box-shadow: inset 0 0 0 0 var(--fm-primary);
  }
  50% {
    box-shadow: inset 0 0 0 6px var(--fm-primary);
  }
}
.locate-badge {
  position: fixed;
  inset-block-start: 50%;
  /* physical `left` (not inset-inline-start) so it stays centered with the always-physical translate
     in RTL too */
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 0.9rem 1.4rem;
  border-radius: 16px;
  background: var(--fm-primary);
  color: var(--fm-primary-contrast, #fff);
  font-size: 1.3rem;
  font-family: var(--font-display);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}
/* Static fallback when motion is reduced — both the OS signal and the in-app setting
   (:root[data-fm-reduced] set by theme.ts), since the global reduced-motion rule zeroes the pulse. */
@media (prefers-reduced-motion: reduce) {
  .shell.locating {
    animation: none;
    box-shadow: inset 0 0 0 4px var(--fm-primary);
  }
}
:global(:root[data-fm-reduced='true']) .shell.locating {
  animation: none;
  box-shadow: inset 0 0 0 4px var(--fm-primary);
}
</style>

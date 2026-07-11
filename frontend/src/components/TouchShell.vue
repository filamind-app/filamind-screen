<script setup lang="ts">
import { ref, computed, onMounted, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import TrustRibbon from '@/components/TrustRibbon.vue'
import Icon, { type IconName } from '@/components/AppIcon.vue'
import PromptDialog from '@/components/PromptDialog.vue'
import ToastHost from '@/components/ToastHost.vue'
import OnScreenKeyboard from '@/components/OnScreenKeyboard.vue'
import SleepShield from '@/components/SleepShield.vue'
import { bindOsk, oskTarget, closeOsk } from '@/core/osk'
import { startIdleWatch } from '@/core/idle'
import { startTempHistory } from '@/core/tempHistory'
import StatusView from '@/views/StatusView.vue'
import SettingsView from '@/views/SettingsView.vue'
import MoveView from '@/views/MoveView.vue'
import TuneView from '@/views/TuneView.vue'
import FilesView from '@/views/FilesView.vue'
import ConsoleView from '@/views/ConsoleView.vue'
import TempView from '@/views/TempView.vue'
import ExtrudeView from '@/views/ExtrudeView.vue'
import MacrosView from '@/views/MacrosView.vue'
import { remoteNav, remoteBanner, remoteLocating, dismissBanner } from '@/core/remote'
import { useControlStore } from '@/core/store/control'
import { useSessionStore } from '@/core/store/session'
import { connector } from '@/core/session'

const { t } = useI18n()
const ctl = useControlStore()
const sess = useSessionStore()

// Show which printer this panel drives: its Moonraker hostname. Falls back to the product name until
// the host answers (and if it never does, e.g. a cold boot before Klipper is up).
const printerName = ref('')
onMounted(async () => {
  bindOsk() // every text input on this device summons the on-screen keyboard
  startIdleWatch() // screen sleep (never while a job is active)
  startTempHistory() // temperature history is warm before the graph is ever opened
  try {
    const info = await connector.call<{ hostname?: string }>('printer.info')
    printerName.value = info?.hostname ?? ''
  } catch {
    printerName.value = ''
  }
})
const brandName = computed(() => printerName.value || 'FilaMind')

// Every tool is a first-class destination on the side rail - no hidden overlay layer, no tab bar
// eating the content height. The rail is a vertical WAI-ARIA tablist.
type View =
  'status' | 'temp' | 'filament' | 'move' | 'tune' | 'files' | 'macros' | 'console' | 'settings'
const view = ref<View>('status')

const views: Record<View, Component> = {
  status: StatusView,
  temp: TempView,
  filament: ExtrudeView,
  move: MoveView,
  tune: TuneView,
  files: FilesView,
  macros: MacrosView,
  console: ConsoleView,
  settings: SettingsView,
}
const viewLabelKeys: Record<View, string> = {
  status: 'shell.tab.status',
  temp: 'temp.title',
  filament: 'extrude.title',
  move: 'move.title',
  tune: 'tune.title',
  files: 'files.title',
  macros: 'macros.title',
  console: 'console.title',
  settings: 'shell.tab.settings',
}
const viewIcons: Record<View, IconName> = {
  status: 'status',
  temp: 'heat',
  filament: 'filament',
  move: 'move',
  tune: 'tune',
  files: 'files',
  macros: 'macros',
  console: 'console',
  settings: 'settings',
}

// The Macros destination only exists when this printer defines user macros.
const hasMacros = computed(() => {
  const settings = sess.object<{ settings?: Record<string, unknown> }>('configfile')?.settings ?? {}
  return Object.keys(settings).some(
    (k) => k.startsWith('gcode_macro ') && !k.slice('gcode_macro '.length).startsWith('_'),
  )
})
const railViews = computed<View[]>(() => {
  const all: View[] = [
    'status',
    'temp',
    'filament',
    'move',
    'tune',
    'files',
    'macros',
    'console',
    'settings',
  ]
  return all.filter((v) => v !== 'macros' || hasMacros.value)
})

const active = computed<Component>(() => views[view.value])

// A view change unmounts the focused input WITHOUT a focusout (the HTML focus-fixup rule fires
// no blur when the element is removed), which would strand the keyboard docked over the new
// view with a detached target. Close it on every navigation.
watch(view, () => {
  if (oskTarget.value) closeOsk()
})

function go(to: string): void {
  // Legacy remote/nav names from other surfaces map onto the rail.
  const target = (to === 'control' ? 'status' : to) as View
  if (target in views) view.value = target
}

// A remote-control "navigate" command from another surface switches the active view.
watch(remoteNav, (r) => {
  if (r) go(r.view)
})

// Print takeover: when a print starts (from ANY surface - a slicer upload, another UI), the
// screen jumps to the job face, like a printer display should. It stays there after completion
// until the user navigates away.
const printState = computed(
  () => sess.object<{ state?: string }>('print_stats')?.state ?? 'standby',
)
watch(printState, (now, was) => {
  if (now === 'printing' && was !== 'printing' && was !== 'paused') view.value = 'status'
})

// Mini print chip: while a job runs and the operator is in another tool, keep it glanceable and
// one tap from the job face (hidden on the status view itself - that IS the job face).
const jobActive = computed(() => printState.value === 'printing' || printState.value === 'paused')
const jobProgress = computed(() => {
  const sd = sess.object<{ progress?: number }>('virtual_sdcard')?.progress
  const disp = sess.object<{ progress?: number }>('display_status')?.progress
  return Math.round((sd ?? disp ?? 0) * 100)
})
const jobFile = computed(() => sess.object<{ filename?: string }>('print_stats')?.filename ?? '')

// Recovery: when Klipper is shutdown/error the write gate is closed by design - these two
// actions are the way back, so they surface on every view with the printer's own message.
const needsRecovery = computed(() => sess.trust === 'shutdown' || sess.trust === 'error')
const recoveryMsg = computed(() => {
  const m = sess.object<{ state_message?: string }>('webhooks')?.state_message ?? ''
  return m.split('\n')[0] ?? ''
})

// Roving-tabindex keyboard support on the vertical rail: up/down + Home/End.
function onRailKey(e: KeyboardEvent): void {
  const list = railViews.value
  const i = list.indexOf(view.value)
  let next = i
  if (e.key === 'ArrowDown') next = (i + 1) % list.length
  else if (e.key === 'ArrowUp') next = (i - 1 + list.length) % list.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = list.length - 1
  else return
  e.preventDefault()
  const target = list[next]
  if (!target) return
  view.value = target
  document.getElementById(`rail-${target}`)?.focus()
}
</script>

<template>
  <div class="shell" :class="{ locating: remoteLocating, 'osk-open': !!oskTarget }">
    <header class="bar">
      <div class="brand">
        <img src="/favicon.svg" alt="" />
        <span class="brand-name" :title="brandName">{{ brandName }}</span>
      </div>
      <div class="bar-right">
        <TrustRibbon />
        <!-- E-STOP is reachable from every view; ungated. -->
        <button
          class="estop-mini"
          type="button"
          :aria-label="t('control.estop')"
          :title="t('control.estop')"
          @click="ctl.emergencyStop()"
        >
          <Icon name="estop" size="1.3rem" />
          <span class="estop-label">{{ t('control.estop') }}</span>
        </button>
      </div>
    </header>

    <!-- Klipper down: the gate is closed, so the recovery actions live here, on every view. -->
    <div v-if="needsRecovery" class="recovery" role="alert">
      <Icon name="warning" size="1.2rem" />
      <span class="recovery-msg">{{ recoveryMsg || t('control.down') }}</span>
      <button
        class="touch-btn recovery-btn"
        type="button"
        :disabled="ctl.busy"
        @click="ctl.restartKlipper()"
      >
        {{ t('control.restart') }}
      </button>
      <button
        class="touch-btn recovery-btn"
        type="button"
        :disabled="ctl.busy"
        @click="ctl.firmwareRestart()"
      >
        {{ t('control.firmwareRestart') }}
      </button>
    </div>

    <!-- Always mounted (v-show) so the aria-live region pre-exists and the first message is announced. -->
    <div
      v-show="remoteBanner"
      class="remote-banner"
      :class="remoteBanner?.level"
      :role="remoteBanner?.level === 'warn' ? 'alert' : 'status'"
      :aria-live="remoteBanner?.level === 'warn' ? 'assertive' : 'polite'"
    >
      <template v-if="remoteBanner">
        <span v-if="remoteBanner.level === 'warn'" class="remote-icon" aria-hidden="true">
          <Icon name="warning" size="1.1rem" />
        </span>
        <span class="remote-msg">{{ remoteBanner.text }}</span>
        <button
          type="button"
          class="remote-dismiss"
          :aria-label="t('shell.remote.dismiss')"
          @click="dismissBanner"
        >
          <Icon name="close" size="1.1rem" />
        </button>
      </template>
    </div>

    <div class="body">
      <!-- The rail: every tool is one tap away, always visible. -->
      <nav
        class="rail"
        role="tablist"
        aria-orientation="vertical"
        :aria-label="t('shell.nav')"
        @keydown="onRailKey"
      >
        <button
          v-for="v in railViews"
          :id="`rail-${v}`"
          :key="v"
          class="rail-btn"
          :class="{ active: view === v }"
          type="button"
          role="tab"
          :aria-selected="view === v"
          :aria-controls="`panel-${v}`"
          :tabindex="view === v ? 0 : -1"
          :title="t(viewLabelKeys[v])"
          :aria-label="t(viewLabelKeys[v])"
          @click="view = v"
        >
          <Icon :name="viewIcons[v]" size="1.5rem" />
        </button>
      </nav>

      <main :id="`panel-${view}`" class="content" role="tabpanel" tabindex="0">
        <component :is="active" @navigate="go" @close="view = 'status'" />
      </main>
    </div>

    <div v-show="remoteLocating" class="locate-badge" role="status" aria-live="polite">
      {{ t('shell.remote.here') }}
    </div>

    <!-- Mini print chip: the running job stays one tap from any other tool. -->
    <button
      v-if="jobActive && view !== 'status'"
      class="print-chip"
      type="button"
      :aria-label="t(viewLabelKeys.status)"
      @click="view = 'status'"
    >
      <span class="chip-dot" :class="printState"></span>
      <span class="chip-pct">{{ jobProgress }}%</span>
      <span v-if="jobFile" class="chip-file" dir="ltr">{{ jobFile }}</span>
    </button>

    <PromptDialog />
    <ToastHost />
    <OnScreenKeyboard />
    <SleepShield />
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
  padding: var(--sp-2) var(--sp-4);
  border-bottom: 1px solid var(--fm-border);
  background: var(--fm-surface);
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-family: var(--font-display);
}
.brand img {
  width: 1.6rem;
  height: 1.6rem;
}
.brand-name {
  color: var(--fm-text);
  font-size: var(--fs-title);
  letter-spacing: 0.03em;
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-right {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
/* Always-present emergency stop; ungated. */
.estop-mini {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--touch);
  padding: 0 var(--sp-3);
  border: 0;
  border-radius: var(--r-pill);
  background: var(--fm-danger);
  color: var(--fm-primary-contrast, #fff);
  font-weight: 700;
  font-size: var(--fs-body);
  cursor: pointer;
}
.estop-mini:active {
  filter: brightness(0.9);
}

.body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-2) var(--sp-1);
  border-inline-end: 1px solid var(--fm-border);
  background: var(--fm-surface);
  overflow-y: auto;
}
.rail-btn {
  min-width: 3.4rem;
  min-height: var(--touch);
  flex: 1;
  max-height: 4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--r-card);
  background: transparent;
  color: var(--fm-text-muted);
  cursor: pointer;
}
.rail-btn.active {
  background: var(--fm-surface-2);
  color: var(--fm-primary);
  box-shadow: inset 3px 0 0 var(--fm-primary);
}
/* The RTL variant (accent bar on the other edge) lives in main.css - a scoped `:global([dir=rtl])`
   selector was collapsed by the minifier to a bare `[dir=rtl] { … }` on <html>. */
/* Height-budgeted: views lay themselves out inside the available space (no page scroll on a
   kiosk panel); lists scroll internally instead. */
.content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--sp-4);
  overflow: hidden;
}
.content > :deep(*) {
  flex: 1;
  min-height: 0;
}
/* While the on-screen keyboard is docked, the content yields its height so the focused
   input stays visible above the keys (views are height-budgeted, so they just compress).
   --osk-h lives in the token layer (the keyboard is teleported outside this scope). */
.shell.osk-open .content {
  padding-bottom: var(--osk-h);
}

/* Klipper-down recovery strip: message + the two restart actions. */
.recovery {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  background: var(--fm-surface-2);
  border-bottom: 1px solid var(--fm-border);
  border-inline-start: 4px solid var(--fm-danger);
  color: var(--fm-danger);
}
.recovery-msg {
  flex: 1;
  color: var(--fm-text);
  font-size: var(--fs-caption);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recovery-btn {
  min-height: var(--touch);
  padding: var(--sp-1) var(--sp-3);
  font-size: var(--fs-caption);
  white-space: nowrap;
}

/* Remote-control message banner (pushed from another surface). */
.remote-banner {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-4);
  background: var(--fm-surface-2);
  border-bottom: 1px solid var(--fm-border);
  border-inline-start: 4px solid var(--fm-primary);
}
.remote-banner.warn {
  border-inline-start-color: var(--fm-warning);
}
.remote-icon {
  color: var(--fm-warning);
  display: inline-flex;
}
.remote-msg {
  flex: 1;
  color: var(--fm-text);
  font-size: var(--fs-body);
}
.remote-dismiss {
  border: 0;
  background: transparent;
  color: var(--fm-text-muted);
  min-width: var(--touch);
  min-height: var(--touch);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* Mini print chip: floating bottom-start - clear of the rail (left), the bottom-centre toasts and
   the bottom-end re-open chip. It lifts above the docked keyboard via a global rule in main.css. */
.print-chip {
  position: fixed;
  inset-block-end: var(--sp-4);
  inset-inline-start: calc(3.4rem + var(--sp-6));
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--touch);
  max-width: 16rem;
  padding: 0 var(--sp-3);
  border: 1px solid var(--fm-border);
  border-radius: var(--r-pill);
  background: var(--fm-surface);
  color: var(--fm-text);
  box-shadow: 0 0.4rem 1.2rem rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.chip-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--fm-primary);
  flex-shrink: 0;
}
.chip-dot.paused {
  background: var(--fm-warning);
}
.chip-pct {
  font-family: var(--font-mono);
  font-weight: 700;
}
.chip-file {
  font-family: var(--font-mono);
  font-size: var(--fs-caption);
  color: var(--fm-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  padding: var(--sp-3) var(--sp-6);
  border-radius: var(--r-card);
  background: var(--fm-primary);
  color: var(--fm-primary-contrast, #fff);
  font-size: var(--fs-title);
  font-family: var(--font-display);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}
/* Static fallback when motion is reduced - both the OS signal and the in-app setting
   (:root[data-fm-reduced] set by theme.ts), since the global reduced-motion rule zeroes the pulse. */
@media (prefers-reduced-motion: reduce) {
  .shell.locating {
    animation: none;
    box-shadow: inset 0 0 0 4px var(--fm-primary);
  }
}
/* The in-app reduced-motion fallback lives in main.css as a plain global. As a scoped
   `:global(:root[data-fm-reduced='true']) .shell.locating` the minifier collapsed it onto <html>,
   painting a stray 4px inset frame around the whole screen whenever reduced-motion was on. */
</style>

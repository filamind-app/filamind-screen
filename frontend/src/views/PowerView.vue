<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/AppIcon.vue'
import ToolHeader from '@/components/ToolHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { usePowerStore, type PowerDevice } from '@/core/store/power'
import { useSessionStore } from '@/core/store/session'

// Moonraker power devices (PSU, lights, ...): one row per device with a live on/off switch. A
// device the printer marks `locked_while_printing` can't be switched mid-job (Moonraker refuses
// it too) - the switch locks and says why, rather than failing on tap.
const { t } = useI18n()
const emit = defineEmits<{ close: [] }>()
const power = usePowerStore()
const store = useSessionStore()

const printing = computed(() => {
  const s = store.object<{ state?: string }>('print_stats')?.state
  return s === 'printing' || s === 'paused'
})
const lockedNow = (d: PowerDevice): boolean => !!d.locked_while_printing && printing.value
</script>

<template>
  <div class="power">
    <ToolHeader :title="t('power.title')" :back-label="t('power.back')" @close="emit('close')" />
    <p class="intro">{{ t('power.intro') }}</p>

    <EmptyState v-if="!power.devices.length" icon="power" :text="t('power.empty')" />

    <ul v-else class="list">
      <li v-for="d in power.devices" :key="d.device" class="dev touch-card" :class="d.status">
        <div class="dev-main">
          <div class="dev-name">{{ d.device }}</div>
          <div class="dev-status">
            <span class="dot" :class="d.status"></span>{{ t('power.status.' + d.status) }}
            <span v-if="lockedNow(d)" class="lock">
              <Icon name="shield" size="0.85rem" /> {{ t('power.locked') }}
            </span>
          </div>
        </div>
        <button
          class="switch"
          type="button"
          role="switch"
          :class="{ on: d.status === 'on' }"
          :aria-checked="d.status === 'on'"
          :aria-label="d.device"
          :disabled="!store.live || power.pending.has(d.device) || lockedNow(d)"
          @click="power.toggle(d.device)"
        >
          <span class="knob"></span>
        </button>
      </li>
    </ul>

    <p v-if="power.devices.length && !store.live" class="hint" role="status">
      <Icon name="shield" size="1rem" /> {{ t('power.offline') }}
    </p>
  </div>
</template>

<style scoped>
.power {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  height: 100%;
  min-height: 0;
}
.intro {
  margin: 0;
  font-size: var(--fs-caption);
  color: var(--fm-text-muted);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  overflow-y: auto;
  min-height: 0;
}
.dev {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
}
.dev-main {
  min-width: 0;
}
.dev-name {
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--fm-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dev-status {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-1);
  font-size: var(--fs-caption);
  color: var(--fm-text-muted);
}
.dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--fm-text-muted);
  flex-shrink: 0;
}
.dot.on {
  background: var(--fm-success, #4caf50);
}
.dot.error {
  background: var(--fm-danger, #e5484d);
}
.lock {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  color: var(--fm-warning);
  margin-inline-start: var(--sp-2);
}
/* An on/off switch sized for touch: the whole 3.4rem track is the target. */
.switch {
  flex-shrink: 0;
  position: relative;
  width: 3.6rem;
  height: 2rem;
  border-radius: 1rem;
  border: 2px solid var(--fm-surface-3, var(--fm-text-muted));
  background: var(--fm-surface-2);
  padding: 0;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}
.switch.on {
  background: var(--fm-primary);
  border-color: var(--fm-primary);
}
.switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.knob {
  position: absolute;
  top: 0.15rem;
  inset-inline-start: 0.15rem;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--fm-text);
  transition: inset-inline-start 0.2s ease;
}
.switch.on .knob {
  /* Slide to the far end. Animating the LOGICAL inset-inline-start (not a physical translateX)
     keeps the "on" position correct under RTL for free - and avoids a scoped `:global([dir=rtl])`
     rule, which the CSS minifier collapses onto <html> (the v0.11.x whole-screen bugs). */
  inset-inline-start: calc(100% - 1.4rem - 0.15rem);
}
.hint {
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-caption);
  color: var(--fm-warning);
}
</style>

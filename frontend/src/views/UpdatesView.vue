<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/AppIcon.vue'
import ToolHeader from '@/components/ToolHeader.vue'
import { useUpdatesStore, type UpdateComponent } from '@/core/store/updates'
import { useSessionStore } from '@/core/store/session'

// Update Manager: the versions of Moonraker's managed components with per-item update / recover.
// A running update streams its log so it isn't an opaque wait; the whole surface is gated on a live
// connection (Moonraker itself also refuses updates mid-print, surfaced as an error toast).
const { t } = useI18n()
const emit = defineEmits<{ close: [] }>()
const up = useUpdatesStore()
const store = useSessionStore()

const canAct = computed(() => store.live && !up.busy)

function statusKey(c: UpdateComponent): string {
  if (!c.valid) return 'invalid'
  if (c.updateAvailable) return 'available'
  if (c.dirty) return 'dirty'
  return 'current'
}
</script>

<template>
  <div class="updates">
    <ToolHeader
      :title="t('updates.title')"
      :back-label="t('updates.back')"
      @close="emit('close')"
    />

    <div class="topbar">
      <span class="summary">
        {{ up.outdated ? t('updates.outdated', { n: up.outdated }) : t('updates.allCurrent') }}
      </span>
      <button
        class="touch-btn check"
        type="button"
        :disabled="!store.live || up.checking || up.busy"
        @click="up.check()"
      >
        <Icon name="refresh" size="1.1rem" :class="{ spin: up.checking }" />
        {{ t('updates.check') }}
      </button>
    </div>

    <!-- Live log while an update runs, so a long git-pull/pip-install isn't an opaque spinner. -->
    <div v-if="up.busy" class="running">
      <div class="running-head">
        <Icon name="refresh" size="1rem" class="spin" />
        {{ t('updates.updating', { name: up.running || '…' }) }}
      </div>
      <pre v-if="up.log.length" class="log" dir="ltr">{{ up.log.join('\n') }}</pre>
    </div>

    <ul class="list">
      <li v-for="c in up.components" :key="c.name" class="comp touch-card">
        <div class="comp-main">
          <div class="comp-name" dir="ltr">{{ c.name }}</div>
          <div class="comp-ver" dir="ltr">
            <span>{{ c.version || '—' }}</span>
            <template v-if="c.updateAvailable">
              <Icon name="arrow-down" size="0.8rem" class="arr" />
              <span class="remote">{{ c.remoteVersion }}</span>
            </template>
          </div>
        </div>
        <div class="comp-side">
          <span class="badge" :class="statusKey(c)">{{ t('updates.status.' + statusKey(c)) }}</span>
          <button
            v-if="c.updateAvailable"
            class="touch-btn-primary act"
            type="button"
            :disabled="!canAct"
            @click="up.update(c.name)"
          >
            {{ t('updates.update') }}
          </button>
          <button
            v-else-if="!c.valid || c.dirty"
            class="touch-btn act"
            type="button"
            :disabled="!canAct"
            @click="up.recover(c.name)"
          >
            {{ t('updates.recover') }}
          </button>
        </div>
      </li>
    </ul>

    <p v-if="!store.live" class="hint" role="status">
      <Icon name="shield" size="1rem" /> {{ t('updates.offline') }}
    </p>
  </div>
</template>

<style scoped>
.updates {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  height: 100%;
  min-height: 0;
}
.topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.summary {
  font-size: var(--fs-caption);
  color: var(--fm-text-muted);
}
.check {
  gap: var(--sp-2);
}
.running {
  flex-shrink: 0;
  border: 1px solid var(--fm-border);
  border-radius: var(--r-card);
  padding: var(--sp-3);
  background: var(--fm-surface-2);
}
.running-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-weight: 600;
  color: var(--fm-primary);
}
.log {
  margin: var(--sp-2) 0 0;
  max-height: 8rem;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: var(--fs-caption);
  white-space: pre-wrap;
  word-break: break-word;
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
.comp {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
}
.comp-main {
  min-width: 0;
}
.comp-name {
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--fm-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.comp-ver {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  margin-top: var(--sp-1);
  font-family: var(--font-mono);
  font-size: var(--fs-caption);
  color: var(--fm-text-muted);
}
.remote {
  color: var(--fm-primary);
}
.arr {
  transform: rotate(-90deg);
  color: var(--fm-primary);
}
.comp-side {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.badge {
  font-size: var(--fs-caption);
  padding: 0.1rem var(--sp-2);
  border-radius: 0.4rem;
  background: var(--fm-surface-3, var(--fm-surface-2));
  color: var(--fm-text-muted);
  white-space: nowrap;
}
.badge.available {
  background: color-mix(in srgb, var(--fm-primary) 22%, transparent);
  color: var(--fm-primary);
}
.badge.dirty,
.badge.invalid {
  background: color-mix(in srgb, var(--fm-warning) 22%, transparent);
  color: var(--fm-warning);
}
.act {
  min-height: 2.6rem;
  font-weight: 600;
}
.act:disabled {
  opacity: 0.45;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.hint {
  flex-shrink: 0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-caption);
  color: var(--fm-warning);
}
</style>

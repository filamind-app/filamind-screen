<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/core/store/session'

const { t, te } = useI18n()
const store = useSessionStore()

interface Heater {
  temperature?: number
  target?: number
}
interface PrintStats {
  state?: string
  filename?: string
}
interface Sdcard {
  progress?: number
}

const ext = computed(() => store.object<Heater>('extruder'))
const bed = computed(() => store.object<Heater>('heater_bed'))
const stats = computed<PrintStats>(() => store.object<PrintStats>('print_stats') ?? {})
const progress = computed(() =>
  Math.round((store.object<Sdcard>('virtual_sdcard')?.progress ?? 0) * 100),
)
const fmt = (n?: number): string => `${(n ?? 0).toFixed(0)}°`
const stateLabel = computed(() => {
  const key = `status.state.${stats.value.state ?? 'standby'}`
  return te(key) ? t(key) : (stats.value.state ?? '—')
})
</script>

<template>
  <div class="status">
    <div class="tiles">
      <div class="tile touch-card">
        <div class="tile-label">{{ t('status.hotend') }}</div>
        <div class="tile-temp">
          {{ fmt(ext?.temperature) }}<span class="tgt"> / {{ fmt(ext?.target) }}</span>
        </div>
      </div>
      <div class="tile touch-card">
        <div class="tile-label">{{ t('status.bed') }}</div>
        <div class="tile-temp">
          {{ fmt(bed?.temperature) }}<span class="tgt"> / {{ fmt(bed?.target) }}</span>
        </div>
      </div>
    </div>

    <div class="print touch-card">
      <div class="print-head">
        <span class="muted">{{ t('status.print') }}</span>
        <span class="state">{{ stateLabel }}</span>
      </div>
      <div class="file" :title="stats.filename || ''">{{ stats.filename || '—' }}</div>
      <div
        class="progress"
        role="progressbar"
        :aria-label="t('status.print')"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div class="pct">{{ progress }}%</div>
    </div>
  </div>
</template>

<style scoped>
.status {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
.tile {
  padding: 1.25rem;
}
.tile-label {
  font-size: 1rem;
  color: var(--fm-text-muted);
}
.tile-temp {
  margin-top: 0.4rem;
  font-family: var(--font-mono);
  font-size: 2.2rem;
  color: var(--fm-text);
}
.tgt {
  font-size: 1.2rem;
  color: var(--fm-text-muted);
}
.print {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.print-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.muted {
  color: var(--fm-text-muted);
}
.state {
  color: var(--fm-text);
  font-size: 1.1rem;
}
.file {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  color: var(--fm-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.progress {
  height: 0.8rem;
  border-radius: 999px;
  background: var(--fm-surface-2);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--fm-primary);
  transition: width 0.3s ease;
}
.pct {
  text-align: end;
  color: var(--fm-text-muted);
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/AppIcon.vue'
import ToolHeader from '@/components/ToolHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'
import { useWriteGuard } from '@/core/useWriteGuard'

// Bed mesh visualization: a heat map of the bed's Z deviation, plus the saved profiles and the
// gcode actions that manage them. Read straight off the `bed_mesh` printer object - the live active
// mesh when one is loaded, or a saved profile's probed points otherwise.
const { t } = useI18n()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const ctl = useControlStore()
const { canWrite, blockedReason } = useWriteGuard()

interface MeshProfile {
  points: number[][]
  mesh_params?: Record<string, unknown>
}
interface BedMesh {
  profile_name?: string
  mesh_matrix?: number[][]
  profiles?: Record<string, MeshProfile>
}

const mesh = computed<BedMesh>(() => store.object<BedMesh>('bed_mesh') ?? {})
const activeName = computed(() => mesh.value.profile_name ?? '')
const profileNames = computed(() => Object.keys(mesh.value.profiles ?? {}))

// A live mesh (a loaded profile) has a non-empty matrix; an empty [[]] means none is loaded.
const liveMatrix = computed<number[][] | null>(() => {
  const m = mesh.value.mesh_matrix
  return m && m.length && (m[0]?.length ?? 0) > 0 ? m : null
})

// Which profile the user is inspecting. Follows the active one, but the chips let them peek at any
// saved profile without loading it onto the machine.
const selected = ref('')
watch(
  [activeName, profileNames],
  () => {
    if (selected.value && profileNames.value.includes(selected.value)) return
    selected.value = activeName.value || profileNames.value[0] || ''
  },
  { immediate: true },
)

// The matrix on screen: the live mesh when we're looking at the loaded profile, else the selected
// profile's stored points.
const matrix = computed<number[][] | null>(() => {
  if (selected.value && selected.value === activeName.value && liveMatrix.value) {
    return liveMatrix.value
  }
  const p = mesh.value.profiles?.[selected.value]
  return p?.points?.length ? p.points : liveMatrix.value
})

const flat = computed(() => (matrix.value ?? []).flat())
const zMin = computed(() => (flat.value.length ? Math.min(...flat.value) : 0))
const zMax = computed(() => (flat.value.length ? Math.max(...flat.value) : 0))
const range = computed(() => zMax.value - zMin.value)
const maxAbs = computed(() => Math.max(Math.abs(zMin.value), Math.abs(zMax.value), 0.0001))

const rows = computed(() => matrix.value?.length ?? 0)
const cols = computed(() => matrix.value?.[0]?.length ?? 0)

/** Diverging heat scale: blue below flat, pale at 0, red above. Absolute (not themed) - a bed map
 *  reads the same way everywhere. */
function heatColor(z: number): string {
  const clamp = Math.max(-1, Math.min(1, z / maxAbs.value))
  if (clamp >= 0) {
    const g = Math.round(255 - clamp * 165)
    const b = Math.round(255 - clamp * 205)
    return `rgb(255,${g},${b})`
  }
  const a = -clamp
  const r = Math.round(255 - a * 205)
  const g = Math.round(255 - a * 120)
  return `rgb(${r},${g},255)`
}

const cells = computed(() => {
  const m = matrix.value
  if (!m) return []
  const out: { x: number; y: number; fill: string }[] = []
  for (let r = 0; r < m.length; r++) {
    const rowArr = m[r] ?? []
    for (let c = 0; c < rowArr.length; c++) {
      // Flip vertically so row 0 (the bed's front) sits at the bottom, like looking down at the bed.
      out.push({ x: c, y: m.length - 1 - r, fill: heatColor(rowArr[c] ?? 0) })
    }
  }
  return out
})

const fmt = (n: number): string => (n >= 0 ? '+' : '') + n.toFixed(3)

function calibrate(): void {
  void ctl.runGcode('BED_MESH_CALIBRATE')
}
function loadProfile(): void {
  if (selected.value) void ctl.runGcode(`BED_MESH_PROFILE LOAD="${selected.value}"`)
}
function clearMesh(): void {
  void ctl.runGcode('BED_MESH_CLEAR')
}
</script>

<template>
  <div class="mesh">
    <ToolHeader :title="t('mesh.title')" :back-label="t('mesh.back')" @close="emit('close')" />

    <div v-if="matrix" class="map-wrap">
      <svg
        class="map"
        :viewBox="`0 0 ${cols} ${rows}`"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        :aria-label="t('mesh.title')"
      >
        <rect
          v-for="(cell, i) in cells"
          :key="i"
          :x="cell.x"
          :y="cell.y"
          width="1.02"
          height="1.02"
          :fill="cell.fill"
        />
      </svg>
      <div class="stats">
        <div class="stat">
          <span class="stat-label">{{ t('mesh.range') }}</span>
          <span class="stat-value">{{ range.toFixed(3) }} mm</span>
        </div>
        <div class="stat">
          <span class="stat-label">{{ t('mesh.min') }}</span>
          <span class="stat-value low">{{ fmt(zMin) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">{{ t('mesh.max') }}</span>
          <span class="stat-value high">{{ fmt(zMax) }}</span>
        </div>
        <div class="scale" aria-hidden="true">
          <span class="scale-bar"></span>
          <div class="scale-ends"><span>−</span><span>0</span><span>+</span></div>
        </div>
      </div>
    </div>
    <div v-else class="empty-fill">
      <EmptyState icon="mesh" :text="t('mesh.empty')" />
    </div>

    <div v-if="profileNames.length" class="profiles">
      <button
        v-for="name in profileNames"
        :key="name"
        class="chip"
        type="button"
        :class="{ on: name === selected }"
        @click="selected = name"
      >
        {{ name }}<span v-if="name === activeName" class="active-dot" :title="t('mesh.loaded')" />
      </button>
    </div>

    <div class="actions">
      <button
        class="touch-btn action"
        type="button"
        :disabled="!canWrite || !selected || selected === activeName"
        :title="canWrite ? '' : blockedReason"
        @click="loadProfile"
      >
        <Icon name="check" size="1.2rem" /> {{ t('mesh.load') }}
      </button>
      <button
        class="touch-btn action"
        type="button"
        :disabled="!canWrite"
        :title="canWrite ? '' : blockedReason"
        @click="clearMesh"
      >
        <Icon name="close" size="1.2rem" /> {{ t('mesh.clear') }}
      </button>
      <button
        class="touch-btn-primary action"
        type="button"
        :disabled="!canWrite"
        :title="canWrite ? '' : blockedReason"
        @click="calibrate"
      >
        <Icon name="refresh" size="1.2rem" /> {{ t('mesh.calibrate') }}
      </button>
    </div>
    <p class="hint">{{ t('mesh.calibrateHint') }}</p>
  </div>
</template>

<style scoped>
.mesh {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  height: 100%;
  min-height: 0;
}
.map-wrap {
  display: flex;
  gap: var(--sp-4);
  align-items: stretch;
  flex: 1;
  min-height: 0;
}
.map {
  flex: 1;
  min-width: 0;
  height: 100%;
  border-radius: 0.5rem;
  background: var(--fm-surface-2);
  /* Crisp cells, no blur between deviation buckets. */
  shape-rendering: crispedges;
}
.stats {
  flex-shrink: 0;
  width: 8rem;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  justify-content: center;
}
.stat {
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: var(--fs-caption);
  color: var(--fm-text-muted);
}
.stat-value {
  font-family: var(--font-mono);
  font-size: var(--fs-title);
  font-variant-numeric: tabular-nums;
  color: var(--fm-text);
}
.stat-value.low {
  color: #3b82f6;
}
.stat-value.high {
  color: #ef4444;
}
.scale {
  margin-top: var(--sp-2);
}
.scale-bar {
  display: block;
  height: 0.5rem;
  border-radius: 0.25rem;
  background: linear-gradient(to right, #3b82f6, #ffffff, #ef4444);
}
.scale-ends {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-caption);
  color: var(--fm-text-muted);
  font-family: var(--font-mono);
}
.empty-fill {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}
.profiles {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-2) var(--sp-3);
  border-radius: 0.5rem;
  border: 2px solid var(--fm-surface-3, var(--fm-text-muted));
  background: var(--fm-surface-2);
  color: var(--fm-text);
  font-size: var(--fs-caption);
  cursor: pointer;
}
.chip.on {
  border-color: var(--fm-primary);
  color: var(--fm-primary);
}
.active-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--fm-primary);
}
.actions {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--sp-2);
}
.action {
  min-height: 3rem;
  font-weight: 600;
}
.action:disabled {
  opacity: 0.45;
}
.hint {
  flex-shrink: 0;
  margin: 0;
  font-size: var(--fs-caption);
  color: var(--fm-text-muted);
  text-align: center;
}
</style>

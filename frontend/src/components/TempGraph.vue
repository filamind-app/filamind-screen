<script setup lang="ts">
import { computed } from 'vue'
import { tempHistory, WINDOW } from '@/core/tempHistory'

// Live temperature sparklines over the rolling history buffer. Pure SVG in USER UNITS (rem
// font/stroke inside a viewBox scales with the SQUARE of the root size - the v0.6.0 lesson),
// stretched to the card via preserveAspectRatio="none".
const props = defineProps<{ names: string[]; labels: Record<string, string> }>()

const W = 300
const H = 100

/** Stable color per series index, from the theme palette. */
const PALETTE = [
  'var(--fm-primary)',
  'var(--fm-warning)',
  'var(--fm-accent)',
  'var(--fm-secondary)',
  'var(--fm-success)',
  'var(--fm-danger)',
]
const colorOf = (i: number): string => PALETTE[i % PALETTE.length]!

const series = computed(() =>
  props.names
    .map((name, i) => ({
      name,
      label: props.labels[name] ?? name,
      color: colorOf(i),
      points: tempHistory.value.get(name) ?? [],
    }))
    .filter((s) => s.points.length >= 2),
)

/** Y spans 0..(hottest sample + headroom), so the graph never clips and idle reads near 0. */
const yMax = computed(() => {
  let max = 0
  for (const s of series.value) for (const t of s.points) if (t > max) max = t
  return Math.max(60, Math.ceil((max + 10) / 20) * 20)
})

function path(points: number[]): string {
  // Newest-last buffer, right-aligned: a part-full buffer starts mid-graph and grows left→right.
  const step = W / (WINDOW - 1)
  const x0 = W - (points.length - 1) * step
  return points
    .map(
      (t, i) =>
        `${i === 0 ? 'M' : 'L'}${(x0 + i * step).toFixed(1)},${(H - (t / yMax.value) * H).toFixed(1)}`,
    )
    .join(' ')
}
</script>

<template>
  <div v-if="series.length" class="graph touch-card">
    <svg class="plot" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
      <line class="grid" :x1="0" :y1="H / 2" :x2="W" :y2="H / 2" />
      <path
        v-for="s in series"
        :key="s.name"
        class="line"
        :d="path(s.points)"
        :stroke="s.color"
        fill="none"
      />
    </svg>
    <div class="legend">
      <span v-for="s in series" :key="s.name" class="tag">
        <span class="dot" :style="{ background: s.color }"></span>{{ s.label }}
        {{ Math.round(s.points[s.points.length - 1] ?? 0) }}°
      </span>
      <span class="scale" dir="ltr">0–{{ yMax }}°</span>
    </div>
  </div>
</template>

<style scoped>
.graph {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-2) var(--sp-3);
}
.plot {
  width: 100%;
  height: 6rem;
}
.grid {
  stroke: var(--fm-border);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}
.line {
  stroke-width: 2;
  vector-effect: non-scaling-stroke; /* uniform line weight despite the stretched viewBox */
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  font-size: var(--fs-caption);
  color: var(--fm-text-muted);
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-variant-numeric: tabular-nums;
}
.dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
}
.scale {
  margin-inline-start: auto;
}
</style>

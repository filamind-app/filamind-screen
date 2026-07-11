import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Regression guard for a bug class that shipped twice: a rule of the form
// `:global(:root[data-x]) .child` (or `:global(html.foo) .child`) written inside a component's
// `<style scoped>` is collapsed by the production CSS minifier into a BARE `:root[data-x] { … }`.
// It drops the scoped `.child` and applies the declarations to `<html>` itself. This mirrored the
// whole Arabic layout (v0.11.5, the `transform: scaleX(-1)` on the back icon) and dimmed the ENTIRE
// screen via the motif opacity (v0.11.6, a default-'subtle' panel booted at 10% opacity). Rules
// that gate a scoped element on a root/`<html>` state attribute must instead live in
// src/assets/styles/main.css as plain (unscoped) global selectors, where the minifier keeps the
// descendant intact.

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

function vueFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...vueFiles(p))
    else if (name.endsWith('.vue')) out.push(p)
  }
  return out
}

// `:global(...)` followed by whitespace and another selector part (a descendant). A standalone
// `:global(x) { … }` is fine (the next non-space is `{`, excluded here); only the descendant form
// collapses. CSS comments are stripped first so the explanatory comments that reference the old
// pattern don't trip the guard.
const COLLAPSE_PRONE = /:global\([^)]*\)\s+[^{\s]/

describe('scoped styles never use a collapse-prone :global(...) descendant', () => {
  const files = vueFiles(SRC)

  it('found .vue files to scan', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const label = file.split(/[\\/]/).slice(-2).join('/')
    it(`${label}: no ":global(...) descendant" in <style scoped>`, () => {
      const source = readFileSync(file, 'utf8')
      const scopedBlocks = [
        ...source.matchAll(/<style[^>]*\bscoped\b[^>]*>([\s\S]*?)<\/style>/g),
      ].map((m) => m[1] ?? '')
      for (const block of scopedBlocks) {
        const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, '')
        const hit = withoutComments.match(COLLAPSE_PRONE)
        expect(
          hit,
          `"${hit?.[0]}" in ${label} — move it to src/assets/styles/main.css as a plain global; ` +
            `the minifier collapses ":global(X) .child" to a bare "X {}" on <html>.`,
        ).toBeNull()
      }
    })
  }
})

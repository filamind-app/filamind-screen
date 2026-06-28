#!/usr/bin/env node
// CI gate: every non-reference locale must carry EXACTLY the `en` key set - no missing, no extra.
//
// Each locale folder holds one JSON file per namespace (common.json, control.json, …). i18n.ts
// keys the message tree by filename (control.title, dashboard.title, …), so this script does the
// same - a flat merge would collide on shared top-level keys like `title`. vue-i18n pluralization
// lives inside string VALUES (`one | other`), never adds keys, so a strict key diff is correct.
//
// With only `en` present this is a trivial pass; it does real work the moment a second locale lands.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const localesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales')
const REFERENCE = 'en'

/** Flatten a nested message object to dotted leaf keys. */
function flattenKeys(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenKeys(v, key, out)
    else out.push(key)
  }
  return out
}

/** Merge every namespace JSON in a locale folder, keyed by filename (matches i18n.ts assemble()). */
function loadLocale(code) {
  const dir = join(localesDir, code)
  const merged = {}
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    merged[file.replace('.json', '')] = JSON.parse(readFileSync(join(dir, file), 'utf8'))
  }
  return merged
}

const codes = readdirSync(localesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

if (!codes.includes(REFERENCE)) {
  console.error(`i18n-keydiff: no reference locale '${REFERENCE}' under ${localesDir}`)
  process.exit(1)
}

const refKeys = new Set(flattenKeys(loadLocale(REFERENCE)))
const others = codes.filter((c) => c !== REFERENCE)
let failed = false

for (const code of others) {
  const keys = new Set(flattenKeys(loadLocale(code)))
  const missing = [...refKeys].filter((k) => !keys.has(k))
  const extra = [...keys].filter((k) => !refKeys.has(k))
  if (missing.length || extra.length) {
    failed = true
    console.error(`✗ ${code}: ${missing.length} missing, ${extra.length} extra key(s) vs ${REFERENCE}`)
    for (const k of missing) console.error(`    missing: ${k}`)
    for (const k of extra) console.error(`    extra:   ${k}`)
  } else {
    console.log(`✓ ${code}: ${refKeys.size} keys match ${REFERENCE}`)
  }
}

if (!others.length) {
  console.log(`i18n-keydiff: only '${REFERENCE}' present (${refKeys.size} keys) - nothing to diff yet.`)
}

process.exit(failed ? 1 : 0)

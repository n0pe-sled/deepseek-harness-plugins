/**
 * Host-half smoke check for dsh-herdr-themes (no test framework): stubs the
 * injected settings service, calls apply(), and asserts the namespace
 * registration, the schema defaults, and the theme catalog (all 18 herdr
 * built-ins with sane token maps). The client bundle is verified as text:
 * wrapper banner/footer, external specifiers, and no bundled duplicates.
 *
 * Run with: node tests/smoke.mjs (after `pnpm build`; imports lib/index.js)
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { apply, HERDR_THEMES, inject, name } from '../lib/index.js'

// ---------------------------------------------------------------------------
// Node half: namespace registration
// ---------------------------------------------------------------------------

let registered = null
const fakeSettings = {
  register(ns, schema) {
    assert.equal(ns, 'herdr-themes')
    assert.equal(typeof schema, 'function') // the schemastery schema is callable
    // The schema defaults the field to '' (built-in preference).
    assert.deepEqual(schema({}), { themeId: '' })
    registered = { ns, schema }
    return { get: () => ({ themeId: '' }), watch: () => () => {}, update: () => {} }
  },
}

const ctx = { settings: fakeSettings }
apply(ctx)
assert.ok(registered, 'apply() must call settings.register')

assert.equal(name, 'herdr-themes')
assert.deepEqual(inject, ['settings'])

// ---------------------------------------------------------------------------
// Theme catalog: all 18 herdr built-ins
// ---------------------------------------------------------------------------

const EXPECTED_IDS = [
  'catppuccin', 'catppuccin-latte', 'terminal', 'tokyo-night', 'tokyo-night-day',
  'dracula', 'nord', 'gruvbox', 'gruvbox-light', 'one-dark', 'one-light',
  'solarized', 'solarized-light', 'kanagawa', 'kanagawa-lotus', 'rose-pine',
  'rose-pine-dawn', 'vesper',
]

assert.equal(HERDR_THEMES.length, 18, 'must ship every herdr default theme')
assert.deepEqual(HERDR_THEMES.map(t => t.id), EXPECTED_IDS, 'catalog order matches herdr THEME_NAMES')

const darkCount = HERDR_THEMES.filter(t => t.colorScheme === 'dark').length
assert.equal(darkCount, 11, '11 dark themes (catppuccin, terminal, tokyo-night, dracula, nord, gruvbox, one-dark, solarized, kanagawa, rose-pine, vesper)')

for (const theme of HERDR_THEMES) {
  assert.ok(theme.name.length > 0, `${theme.id} has a name`)
  assert.ok(theme.description.length > 0, `${theme.id} has a description`)
  // every id must be re-persistable in the built-in schema sense: no '/'
  assert.ok(!theme.id.includes('/'), `${theme.id} is a flat id`)
  // token map must cover the core surfaces and label/brand roles
  for (const token of [
    '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2',
    '--dsw-alias-brand-primary', '--dsw-alias-label-primary',
    '--dsw-alias-label-secondary', '--dsw-alias-state-error-primary',
    '--dsw-alias-state-success-primary', '--dsw-alias-state-warn-primary',
    '--dsw-specific-sidebar-fill',
  ]) {
    assert.equal(typeof theme.tokens[token], 'string', `${theme.id}.${token} set`)
  }
  // palette values are hex
  for (const color of Object.values(theme.palette)) {
    assert.match(color, /^#[0-9a-f]{6}$/, `${theme.id} palette value ${color}`)
  }
}

// Catppuccin is the herdr default: spot-check a couple of exact values.
const catppuccin = HERDR_THEMES[0]
assert.equal(catppuccin.id, 'catppuccin')
assert.equal(catppuccin.palette.panelBg, '#181825')
assert.equal(catppuccin.tokens['--dsw-alias-brand-primary'], '#89b4fa')
assert.equal(catppuccin.tokens['--dsw-alias-bg-base'], '#181825')
assert.equal(catppuccin.tokens['--dsw-alias-label-primary'], '#cdd6f4')

// ---------------------------------------------------------------------------
// Client bundle shape
// ---------------------------------------------------------------------------

const here = fileURLToPath(new URL('.', import.meta.url))
const client = readFileSync(`${here}../lib/client.js`, 'utf8')

assert.match(client, /window\.__ModuleLoader__\.load\(\{\s*id: "dsh-herdr-themes",\s*factory: \(require\) => \{/)
assert.match(client, /return module\.exports;\s*\}\s*\}\);/)
assert.match(client, /require\("react"\)/, 'react stays external')
assert.match(client, /require\("react\/jsx-runtime"\)/, 'jsx-runtime stays external')
assert.ok(!client.includes('require("@deepseek-ai/'), 'no cross-plugin value imports (purity gate)')
assert.ok(client.includes('catppuccin-latte'), 'palette data bundled')
assert.ok(client.includes('--dsw-alias-bg-overlay'), 'token builder bundled')

console.log('smoke.mjs: all assertions passed')

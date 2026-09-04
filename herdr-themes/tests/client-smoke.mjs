/**
 * Browser-half smoke check for dsh-herdr-themes: loads the real built
 * lib/client.js through the __ModuleLoader__ contract (react externals resolved
 * from this package's node_modules), then drives the exported apply() with a
 * fake ClientContext and asserts the full interaction model:
 *  1. every herdr theme is registered;
 *  2. a persisted selection is adopted on boot (with stale-id recovery);
 *  3. preview applies live; apply persists; cancel reverts;
 *  4. the ThemeRuntime built-in adoption reset (any settings event) is
 *     re-asserted: the saved theme comes back and the stored id survives;
 *  5. the settings.section registration carries id/order/label and an inject
 *     face with selector hooks + actions.
 *
 * Run with: node tests/client-smoke.mjs
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = fileURLToPath(new URL('.', import.meta.url))
const bundle = readFileSync(`${here}../lib/client.js`, 'utf8')

// --- execute the real bundle under the loader contract ----------------------
let pending = null
globalThis.window = {
  __ModuleLoader__: { load: (definition) => { pending = definition } },
}
new Function(bundle)()
assert.ok(pending, 'bundle must hand off through window.__ModuleLoader__.load')
const mod = pending.factory((id) => require(id))

assert.equal(typeof mod.apply, 'function')
assert.deepEqual(mod.inject, ['slots', 'settingsScope', 'theme'])

// --- fake top-level context -------------------------------------------------
const themes = []
let preference = 'system'
let revision = 0
let snapshot = null
const themeListeners = []
const theme = {
  register(def) {
    if (themes.some(t => t.id === def.id)) throw new Error(`theme "${def.id}" is already registered`)
    themes.push(def)
    return () => {}
  },
  setTheme(id) {
    if (id !== 'system' && !themes.some(t => t.id === id)) throw new Error(`theme "${id}" is not registered`)
    if (preference === id) return
    preference = id
    publish()
  },
  getTheme() { return snapshot },
}
function publish() {
  const active = themes.find(t => t.id === preference) ?? themes.find(t => t.id === (preference === 'system' ? 'dark' : preference))
  snapshot = {
    preference,
    active: { id: preference === 'system' ? (active?.id ?? 'dark') : preference, tokens: {} },
    themes: [...themes],
    revision: ++revision,
  }
  for (const listener of [...themeListeners]) listener(snapshot)
}

/** Simulate ThemeRuntime.adopt(): adopt the durable built-in preference, publish. */
function simulateAdopt(id) {
  preference = id
  publish()
}

// --- fake settings scope over the mirror -----------------------------------
let stored = { themeId: '' }
let scopeStatus = 'loading'
const scopeListeners = []
const scope = {
  getSnapshot() {
    return { status: scopeStatus, value: { ...stored }, writable: true, mode: 'host', revision: 1 }
  },
  subscribe(listener) {
    scopeListeners.push(listener)
    return () => {}
  },
  async set(field, value) {
    stored = { ...stored, [field]: value }
    scopeStatus = 'ready'
    for (const listener of [...scopeListeners]) listener()
  },
}

const slotRegistrations = []
const ctx = {
  theme,
  settingsScope: { bind: (spec) => {
    assert.equal(spec.namespace, 'herdr-themes')
    return scope
  } },
  slots: {
    inject(name, factory) {
      assert.equal(name, 'settings.section')
      const registration = factory()
      slotRegistrations.push({ name, ...registration })
    },
    register(options, component) {
      return { ...options, component }
    },
  },
  effect(fn, label) {
    void label
    const dispose = fn()
    return () => { if (typeof dispose === 'function') dispose() }
  },
  on(event, listener) {
    assert.equal(event, 'theme/change')
    themeListeners.push(listener)
    return () => {}
  },
}

mod.apply(ctx)
publish()

// 1. all 18 themes registered
assert.equal(themes.length, 18, 'all herdr themes registered')
assert.ok(themes.some(t => t.id === 'rose-pine'))
assert.ok(themes.every(t => t.tokens['--dsw-alias-brand-primary'] !== undefined))

// 2. settings section registration shape
assert.equal(slotRegistrations.length, 1)
const entry = slotRegistrations[0]
assert.equal(entry.name, 'settings.section')
assert.equal(entry.id, 'herdr-themes')
assert.equal(entry.order, 5)
assert.equal(entry.label, 'Themes')
assert.equal(typeof entry.component, 'function')
const face = entry.inject()
assert.equal(typeof face.hooks.selection.getSnapshot, 'function')
assert.equal(typeof face.hooks.theme.getSnapshot, 'function')
assert.equal(typeof face.actions.preview, 'function')
assert.equal(typeof face.actions.apply, 'function')
assert.equal(typeof face.actions.cancel, 'function')

// 3. persisted selection adopted on boot (scope arrives with a saved id)
stored = { themeId: 'rose-pine' }
scopeStatus = 'ready'
for (const listener of [...scopeListeners]) listener()
assert.equal(preference, 'rose-pine', 'saved theme re-applied on boot')

// 4. preview applies live
face.actions.preview('dracula')
assert.equal(preference, 'dracula')

// 5. apply persists and verifies via read-back
const outcome = await face.actions.apply('dracula')
assert.deepEqual(outcome, { status: 'saved' })
assert.equal(stored.themeId, 'dracula')

// 6. cancel reverts to the stored theme
face.actions.preview('vesper')
assert.equal(preference, 'vesper')
face.actions.cancel()
assert.equal(preference, 'dracula', 'cancel reverts to stored theme')

// 7. THE BUG THIS GUARDS AGAINST: ThemeRuntime re-adopts the durable
// built-in preference whenever the settings document re-derives (our own
// write triggers that too), resetting a third-party theme to system. The
// saved theme must be re-applied and the stored id must NOT be cleared.
simulateAdopt('system')
assert.equal(preference, 'dracula', 'saved theme re-asserted after built-in adoption reset')
assert.equal(stored.themeId, 'dracula', 'stored id survives the reset')

// 8. system apply clear path (clear-then-switch, so reassertion cannot fight it)
const systemOutcome = await face.actions.apply('system')
assert.deepEqual(systemOutcome, { status: 'saved' })
assert.equal(stored.themeId, '')
assert.equal(preference, 'system')

// 9. a built-in event after clearing stays cleared (no reassert, no flapping)
simulateAdopt('dark')
assert.equal(preference, 'dark', 'built-in choice stands once no theme is saved')
assert.equal(stored.themeId, '')

// 10. stale stored id recovers instead of throwing
stored = { themeId: 'no-such-theme' }
for (const listener of [...scopeListeners]) listener()
assert.equal(stored.themeId, '', 'stale id cleared itself')
assert.equal(preference, 'dark')

console.log('client-smoke.mjs: all assertions passed')

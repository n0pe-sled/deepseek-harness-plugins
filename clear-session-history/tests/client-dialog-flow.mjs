/**
 * Headless dialog-interaction test for the confirm flow, run under the
 * harness checkout's jsdom. Loads the BUILT lib/client.js, applies it with a
 * stub ctx whose preview reports deletable logs, clicks the injected
 * Clear All Session History button, and drives the REAL React dialog:
 *   - the acknowledgement checkbox must toggle on click (this is the exact
 *     detached-root + portal-to-body path the live page uses);
 *   - the confirm button must enable only after acknowledgement;
 *   - confirm must call the remote clear with the all-workspaces scope.
 *
 * RiskConfirmation/Modal are externals in the bundle; the surrogate below
 * mirrors the shipped primitives' structure exactly (portal to document.body,
 * controlled checkbox honoring `disabled`, confirm gated on `acknowledged`),
 * so the state wiring under test is the plugin's own dialog component.
 *
 * Run with the harness checkout reachable for jsdom/react:
 *   DSH_CLEAR_HISTORY_HARNESS=/path/to/deepseek-harness node tests/client-dialog-flow.mjs
 */

import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pluginDir = new URL('..', import.meta.url).pathname
const harness = process.env.DSH_CLEAR_HISTORY_HARNESS ?? ''
if (harness === '') {
  console.error('set DSH_CLEAR_HISTORY_HARNESS to a deepseek-harness checkout to run the dialog flow test')
  process.exit(0)
}
const pnpm = `${harness}/node_modules/.pnpm`
const reactStore = `${pnpm}/react@18.3.1/node_modules/react`
const reactDomStore = `${pnpm}/react-dom@18.3.1_react@18.3.1/node_modules/react-dom`
const jsdomStore = `${pnpm}/jsdom@29.1.1/node_modules/jsdom`
const storeRequire = createRequire(`${reactStore}/package.json`)
const { JSDOM } = storeRequire(jsdomStore)

// ---- Minimal jsdom browser environment -----------------------------------
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const { window } = dom
for (const key of ['window', 'document', 'navigator', 'MutationObserver', 'requestAnimationFrame',
  'cancelAnimationFrame', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node',
  'PointerEvent', 'CustomEvent', 'Event', 'MouseEvent', 'getComputedStyle', 'location']) {
  const value = key === 'window' ? window : window[key]
  try {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  } catch {
    // Skip read-only host globals (e.g. navigator on newer Node).
  }
}
try { Object.defineProperty(globalThis, 'self', { value: window, configurable: true, writable: true }) } catch { /* ignore */ }

// ---- Module stubs for the bundle's externals ------------------------------
const localRequire = createRequire(`${reactStore}/package.json`)
const react = localRequire(reactStore)
const jsxRuntime = localRequire(`${reactStore}/jsx-runtime.js`)
const reactClient = localRequire(`${reactDomStore}/client.js`)
const reactDom = localRequire(reactDomStore)

const { createElement: h } = react

/** Structural mirror of the shipped RiskConfirmation (Modal collapsed in):
 * portal to document.body, controlled checkbox honoring `disabled`, confirm
 * gated on `disabled || !acknowledged`. */
function RiskConfirmation({
  open, title, description, acknowledgeLabel, cancelLabel, confirmLabel,
  acknowledged, disabled = false, onAcknowledgedChange, onCancel, onConfirm,
}) {
  if (!open) return null
  return reactDom.createPortal(
    h('div', { role: 'presentation' },
      h('div', { 'aria-hidden': 'true', onClick: onCancel }),
      h('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('p', { 'data-test-description': 'true' }, description),
        h('label', null,
          h('input', {
            type: 'checkbox',
            checked: acknowledged,
            disabled,
            onChange: (event) => { onAcknowledgedChange(event.currentTarget.checked) },
          }),
          h('span', null, acknowledgeLabel),
        ),
        h('button', { type: 'button', 'data-test-cancel': 'true', onClick: onCancel }, cancelLabel),
        h('button', {
          type: 'button',
          'data-test-confirm': 'true',
          disabled: disabled || !acknowledged,
          onClick: onConfirm,
        }, confirmLabel),
      ),
    ),
    window.document.body,
  )
}

const factoryRequire = (specifier) => {
  switch (specifier) {
    case 'react': return react
    case 'react/jsx-runtime': return jsxRuntime
    case 'react-dom/client': return reactClient
    case '@deepseek-ai/dsh-client-ui-primitives': return { RiskConfirmation }
    default: throw new Error(`unsupported require in client bundle: ${specifier}`)
  }
}

// ---- Load the built client bundle -----------------------------------------
let capturedFactory = null
window.__ModuleLoader__ = { load: (spec) => { capturedFactory = spec.factory } }
const bundleRun = new Function('window', 'document', readFileSync(`${pluginDir}/lib/client.js`, 'utf8'))
bundleRun(window, window.document)
assert.ok(typeof capturedFactory === 'function', 'bundle must register a factory')
const { apply } = capturedFactory(factoryRequire)
assert.equal(typeof apply, 'function')

// ---- Simulated sidebar: the New Session button the clear-all clone anchors on
const body = window.document.body
const newSession = window.document.createElement('button')
newSession.setAttribute('type', 'button')
newSession.setAttribute('aria-label', 'New session')
const newSessionLabel = window.document.createElement('span')
newSessionLabel.textContent = 'New Session'
newSession.appendChild(newSessionLabel)
const rail = window.document.createElement('div')
rail.appendChild(newSession)
body.appendChild(rail)

// ---- Stub ctx: preview says 3 logs are deletable; clear reports a partial
// result (2 of 3) so the flow ends in the in-dialog result message instead of
// window.location.reload(), which jsdom cannot perform.
const calls = { preview: [], clear: [] }
const remoteNamespace = {
  preview: async (input) => {
    calls.preview.push(input)
    return { ok: true, value: { ok: true, targets: 3, kept: 0 } }
  },
  clear: async (input) => {
    calls.clear.push(input)
    return { ok: true, value: { ok: true, deleted: 2, targets: 3, kept: 0, removed: 0 } }
  },
  previewSession: async () => ({ ok: true, value: { ok: true, targets: 1, kept: 0 } }),
  clearSession: async () => ({ ok: true, value: { ok: true, deleted: 1, targets: 1, kept: 0, removed: 0 } }),
}
const ctx = {
  remote: { $mount: async () => {} },
  get: (key) => (key === 'remote.clearSessionHistory' ? remoteNamespace : undefined),
  effect: () => () => {},
  sessions: {
    list: { getSnapshot: () => ({ byId: {}, ids: [] }) },
    refresh: async () => {},
  },
  workspaces: { list: { getSnapshot: () => ({ items: [], archivedSessionIds: [] }) } },
}
apply(ctx)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// The clear-all button lands one rAF after install.
await sleep(50)
const clearAll = window.document.querySelector('[data-dsh-clear-all]')
assert.ok(clearAll !== null, 'clear-all button must be injected next to New Session')
assert.equal(clearAll.getAttribute('aria-label'), 'Clear All Session History')
assert.ok([...clearAll.querySelectorAll('span')].some(span => span.textContent === 'Clear All Session History'),
  'button label is title case')

// ---- Open the dialog and let the preview land ------------------------------
clearAll.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
await sleep(50)

const dialog = window.document.querySelector('[role="dialog"]')
assert.ok(dialog !== null, 'confirm dialog must render on the portal root')
assert.equal(dialog.getAttribute('aria-label'), 'Clear All Session History')
assert.equal(calls.preview.length, 1, 'opening the dialog fires exactly one preview')
assert.deepEqual(calls.preview[0], { workspaceTitle: '', titleOccurrence: 0 })

const description = dialog.querySelector('[data-test-description]')
assert.match(description.textContent, /permanently deletes 3 session logs/, 'preview count reaches the copy')

// ---- The checkbox must toggle and gate the confirm button ------------------
const checkbox = dialog.querySelector('input[type="checkbox"]')
const confirmButton = dialog.querySelector('[data-test-confirm]')
assert.ok(checkbox !== null && confirmButton !== null)
assert.equal(checkbox.disabled, false, 'checkbox is enabled once the preview reports targets')
assert.equal(checkbox.checked, false)
assert.equal(confirmButton.disabled, true, 'confirm stays disabled before acknowledgement')

checkbox.click()
await sleep(30)
assert.equal(checkbox.checked, true, 'clicking the checkbox must check it (React onChange round-trip)')
assert.equal(confirmButton.disabled, false, 'acknowledgement enables the confirm button')

// Unchecking works too, and disables confirm again.
checkbox.click()
await sleep(30)
assert.equal(checkbox.checked, false, 'clicking again unchecks')
assert.equal(confirmButton.disabled, true)

// ---- Confirm drives the clear with the all-workspaces scope ----------------
checkbox.click()
await sleep(30)
confirmButton.click()
await sleep(50)
assert.equal(calls.clear.length, 1, 'confirm fires exactly one clear')
assert.deepEqual(calls.clear[0], { workspaceTitle: '', titleOccurrence: 0 })
assert.match(
  window.document.querySelector('[data-test-description]').textContent,
  /Deleted 2 of 3 session logs/,
  'partial-clear result message replaces the description',
)

console.log('client dialog flow: all assertions passed')
// The augmentation's fallback interval keeps the loop alive; exit explicitly.
process.exit(0)

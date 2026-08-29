/**
 * Headless client-flow harness for the Delete-session path, run under the
 * harness checkout's jsdom. Loads the BUILT lib/client.js (via a fake
 * window.__ModuleLoader__), applies it with stub ctx, builds a simulated
 * grouped sidebar, and drives the real pointerdown -> menu -> click ->
 * sessionId resolution path. Asserts the resolved session id the dialog would
 * act on.
 *
 * Run with the harness checkout reachable for jsdom/react:
 *   node tests/client-session-flow.mjs
 */

import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pluginDir = new URL('..', import.meta.url).pathname
// The harness checkout supplies jsdom/react for this local dev harness test.
// Point it at the checkout, e.g.:
//   DSH_CLEAR_HISTORY_HARNESS=/path/to/deepseek-harness node tests/client-session-flow.mjs
const harness = process.env.DSH_CLEAR_HISTORY_HARNESS ?? ''
if (harness === '') {
  console.error('set DSH_CLEAR_HISTORY_HARNESS to a deepseek-harness checkout to run the client flow test')
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
  'cancelAnimationFrame', 'HTMLElement', 'HTMLButtonElement', 'Element', 'Node', 'PointerEvent',
  'CustomEvent', 'Event', 'getComputedStyle', 'location']) {
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

// The dialog is closed at mount, so RiskConfirmation never renders here; a
// null stub is enough to satisfy the import.
const primitivesStub = { RiskConfirmation: () => null }

const factoryRequire = (specifier) => {
  switch (specifier) {
    case 'react': return react
    case 'react/jsx-runtime': return jsxRuntime
    case 'react-dom/client': return reactClient
    case '@deepseek-ai/dsh-client-ui-primitives': return primitivesStub
    default: throw new Error(`unsupported require in client bundle: ${specifier}`)
  }
}

// ---- Load the built client bundle -----------------------------------------
let capturedFactory = null
window.__ModuleLoader__ = { load: (spec) => { capturedFactory = spec.factory } }
// Run the bundle script with the jsdom window in scope (it only touches
// `window.__ModuleLoader__.load` at the top level; the factory receives the
// module require).
const bundleRun = new Function('window', 'document', readFileSync(`${pluginDir}/lib/client.js`, 'utf8'))
bundleRun(window, window.document)
assert.ok(typeof capturedFactory === 'function', 'bundle must register a factory')
const moduleExports = capturedFactory(factoryRequire)
const { apply } = moduleExports
assert.equal(typeof apply, 'function')

// ---- Build the simulated grouped sidebar -----------------------------------
// Workspace "w1" group: header (workspace "…" anchor) + 3 session rows.
// Rows are div[role=treeitem][aria-selected], each with a title span and a
// row "…" anchor button[aria-label="Session actions for <title>"].
const body = window.document.body
const tree = window.document.createElement('div')
tree.setAttribute('role', 'tree')

const group = window.document.createElement('div')
group.className = 'groupSection'
const header = window.document.createElement('div')
const wsAnchor = window.document.createElement('button')
wsAnchor.setAttribute('type', 'button')
wsAnchor.setAttribute('aria-label', 'Workspace actions for w1')
header.appendChild(wsAnchor)
group.appendChild(header)

// DOM rows in the sidebar's default 'updated' order (recency), which is NOT
// the workspace account order below — the resolver must not assume account
// order. 'Beta' appears twice to exercise same-title disambiguation, and the
// store rows carry displayTitle (durable title absent), matching the real
// SessionSummary shape for sessions without a projected title.
const ROWS = [
  { id: 'sC', title: 'Gamma', updatedAt: 300 },
  { id: 'sB', title: 'Beta', updatedAt: 200 },
  { id: 'sB2', title: 'Beta', updatedAt: 150 },
  { id: 'sA', title: 'Alpha', updatedAt: 100 },
]
const rowEls = {}
for (const row of ROWS) {
  const el = window.document.createElement('div')
  el.setAttribute('role', 'treeitem')
  el.setAttribute('aria-selected', 'false')
  const title = window.document.createElement('span')
  title.textContent = row.title
  el.appendChild(title)
  const actions = window.document.createElement('span')
  const anchor = window.document.createElement('button')
  anchor.setAttribute('type', 'button')
  anchor.setAttribute('aria-label', `Session actions for ${row.title}`)
  actions.appendChild(anchor)
  el.appendChild(actions)
  rowEls[row.id] = { el, anchor }
  group.appendChild(el)
}
tree.appendChild(group)
body.appendChild(tree)

// ---- Stub ctx --------------------------------------------------------------
// Store rows carry displayTitle + updatedAt only (no durable title), like a
// real session whose title projection has not landed. Account order differs
// from DOM order on purpose.
const byId = {}
for (const row of ROWS) byId[row.id] = { displayTitle: row.title, updatedAt: row.updatedAt }
const accountOrder = ['sA', 'sB2', 'sB', 'sC']

const captured = { previewSessionInput: null }
const remoteNamespace = {
  preview: async () => ({ ok: true, value: { ok: true, targets: 0, kept: 0 } }),
  clear: async () => ({ ok: true, value: { ok: true, deleted: 0, targets: 0, kept: 0, removed: 0 } }),
  previewSession: async (input) => {
    captured.previewSessionInput = input
    return { ok: true, value: { ok: true, targets: 1, kept: 0 } }
  },
  clearSession: async (input) => ({ ok: true, value: { ok: true, deleted: 1, targets: 1, kept: 0, removed: 0 } }),
}
const ctx = {
  remote: {
    $mount: async () => {},
  },
  get: (key) => {
    if (key === 'remote.clearSessionHistory') return remoteNamespace
    return undefined
  },
  effect: () => () => {},
  sessions: { list: { getSnapshot: () => ({ byId, ids: ROWS.map(r => r.id) }) } },
  workspaces: {
    list: { getSnapshot: () => ({ items: [{ title: 'w1', sessionIds: accountOrder }], archivedSessionIds: [] }) },
  },
}
apply(ctx)

// ---- Drive one delete: pointerdown on a row's "…", portal menu, click -------
async function driveDelete(anchor) {
  captured.previewSessionInput = null
  anchor.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, composed: true }))

  const menu = window.document.createElement('div')
  menu.setAttribute('role', 'menu')
  for (const label of ['Rename', 'Fork session', 'Archive session']) {
    const item = window.document.createElement('button')
    item.setAttribute('role', 'menuitem')
    const w = window.document.createElement('div')
    w.className = 'itemWrap'
    const icon = window.document.createElement('span')
    icon.className = 'itemIcon'
    icon.appendChild(window.document.createElement('svg'))
    const lbl = window.document.createElement('span')
    lbl.className = 'itemLabel'
    lbl.textContent = label
    w.appendChild(item)
    item.appendChild(icon)
    item.appendChild(lbl)
    menu.appendChild(w)
  }
  body.appendChild(menu)

  // Let microtasks settle, then click the injected Delete session row.
  await new Promise(r => setTimeout(r, 30))
  const deleteRow = menu.querySelector('[data-dsh-clear-session]')
  assert.ok(deleteRow !== null, 'Delete session row must be injected into the session menu')
  assert.equal(deleteRow.getAttribute('aria-label'), 'Delete session')

  deleteRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await new Promise(r => setTimeout(r, 30))
  menu.remove()
  return captured.previewSessionInput
}

try {
  // 1. Store fallback, unique title: DOM order (recency) differs from the
  //    account order, and the store rows only carry displayTitle.
  assert.deepEqual(
    await driveDelete(rowEls.sA.anchor),
    { sessionId: 'sA' },
    'unique-title fallback must resolve Alpha by displayTitle, not account index',
  )

  // 2. Store fallback, duplicate title: the second visible Beta row must
  //    resolve to the second-most-recent Beta.
  assert.deepEqual(
    await driveDelete(rowEls.sB2.anchor),
    { sessionId: 'sB2' },
    'same-title fallback must resolve the second Beta row by recency index',
  )
  assert.deepEqual(
    await driveDelete(rowEls.sB.anchor),
    { sessionId: 'sB' },
    'same-title fallback must resolve the first Beta row by recency index',
  )

  // 3. Fiber path: a row exposing a React fiber chain resolves by node.id
  //    even when the store could not (id absent from every store row).
  const gammaRow = rowEls.sC.el
  gammaRow['__reactFiber$test'] = {
    memoizedProps: {},
    return: { memoizedProps: { node: { id: 'sFiber', title: 'Gamma' } }, return: null },
  }
  assert.deepEqual(
    await driveDelete(rowEls.sC.anchor),
    { sessionId: 'sFiber' },
    'a row with a React fiber must resolve by the fiber node id',
  )

  console.log('client session flow: all assertions passed')
  process.exit(0)
} catch (error) {
  console.error('client session flow FAILED:', error)
  process.exit(1)
}

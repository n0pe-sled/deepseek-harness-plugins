/**
 * Host-half smoke test for dsh-clear-session-history, run without the harness.
 *
 * Exercises the plugin against a stubbed Cordis context and a temp sessions
 * root (never the real $DSH_HOME):
 *   - name / inject contract;
 *   - apply() wiring: receiver registration, typert contribution;
 *   - preview/clear scoped to one workspace: only that workspace's cold logs
 *     are deleted; the live session and its cold subagent are kept;
 *   - clear-all: orphaned no-cwd logs go, protected lineages survive;
 *   - workspace resolution: unknown titles fail soft, occurrence picks the
 *     right row among same-titled workspaces.
 *
 * Run with: node tests/smoke.mjs
 */

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const plugin = await import('../lib/index.js')

/** Stub Cordis context: records provisions and typert contributions. */
function makeCtx(services) {
  const provided = {}
  const contributions = []
  return {
    provided,
    contributions,
    ctx: {
      get: name => services[name],
      provide: (name, value) => { provided[name] = value },
      typert: { register: contribution => contributions.push(contribution) },
      effect: () => () => {},
      logger: { info() {}, warn() {} },
    },
  }
}

/** Build a fake sessions root with one workspace's project dir and _no-cwd. */
function makeSessionsRoot() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-clear-history-'))
  const wsDir = join(root, '--Users-test-ws--')
  for (const id of ['session-aaaa-1111', 'session-bbbb-2222', 'session-live-3333', 'session-sub-4444']) {
    mkdirSync(join(wsDir, id), { recursive: true })
    writeFileSync(join(wsDir, id, 'session.jsonl.zstd'), 'stub')
  }
  mkdirSync(join(root, '_no-cwd', 'session-orphan-5555'), { recursive: true })
  writeFileSync(join(root, '_no-cwd', 'session-orphan-5555', 'session.jsonl.zstd'), 'stub')
  return root
}

const HEADERS = [
  { id: 'session-aaaa-1111', cwd: '/Users/test/ws' },
  { id: 'session-bbbb-2222', cwd: '/Users/test/ws' },
  { id: 'session-live-3333', cwd: '/Users/test/ws' },
  { id: 'session-sub-4444', cwd: '/Users/test/ws', origin: 'subagent', parentSession: 'session-live-3333' },
  { id: 'session-orphan-5555' },
]

/** Persistence stub resolving artifact paths inside the fake root. */
function makePersistence(root) {
  const dirFor = (header) => {
    const project = header.cwd === undefined ? '_no-cwd' : '--Users-test-ws--'
    return join(root, project, header.id)
  }
  return {
    list: async () => HEADERS,
    locate: header => ({ kind: 'jsonl', path: join(dirFor(header), 'session.jsonl.zstd') }),
  }
}

const SESSIONS = { list: () => [{ id: 'session-live-3333' }] }
const REGISTRY = {
  list: () => [
    { id: 'ws-1', path: '/Users/test/ws', title: 'ws' },
    { id: 'ws-2', path: '/Users/test/ws2', title: 'ws' },
  ],
}

const exists = (root, ...parts) => existsSync(join(root, ...parts))

// ---- Contract ------------------------------------------------------------

assert.equal(typeof plugin.apply, 'function')
assert.equal(plugin.name, 'clear-session-history')
assert.deepEqual([...plugin.inject].sort(), ['sessionPersistence', 'sessions', 'typert', 'workspaceRegistry'])

// ---- apply wiring ---------------------------------------------------------

const root = makeSessionsRoot()
const { ctx, provided, contributions } = makeCtx({
  sessionPersistence: makePersistence(root),
  sessions: SESSIONS,
  workspaceRegistry: REGISTRY,
})
plugin.apply(ctx)

const receiver = provided.clearSessionHistory
assert.ok(receiver, 'receiver must be provided under the service key')
assert.equal(contributions.length, 1, 'exactly one typert contribution')
assert.deepEqual(contributions[0].invocations.map(d => d.method).sort(), ['clear', 'preview'])

// ---- preview scoped to one workspace ---------------------------------------

const wsInput = { workspaceTitle: 'ws', titleOccurrence: 0 }
const preview = await receiver.preview(wsInput)
assert.deepEqual(preview, { ok: true, targets: 2, kept: 2 }, 'two cold logs targeted, live + its subagent kept')
assert.ok(exists(root, '--Users-test-ws--', 'session-aaaa-1111'), 'preview deletes nothing')

// ---- clear scoped to one workspace -----------------------------------------

const cleared = await receiver.clear(wsInput)
assert.equal(cleared.ok, true)
if (cleared.ok) {
  assert.equal(cleared.deleted, 2)
  assert.equal(cleared.kept, 2)
}
assert.ok(!exists(root, '--Users-test-ws--', 'session-aaaa-1111'), 'cold log removed')
assert.ok(!exists(root, '--Users-test-ws--', 'session-bbbb-2222'), 'cold log removed')
assert.ok(exists(root, '--Users-test-ws--', 'session-live-3333'), 'live log kept')
assert.ok(exists(root, '--Users-test-ws--', 'session-sub-4444'), 'cold subagent of live kept')

// ---- clear-all --------------------------------------------------------------

const all = await receiver.clear({ workspaceTitle: '', titleOccurrence: 0 })
assert.equal(all.ok, true)
if (all.ok) {
  assert.equal(all.deleted, 1, 'only the orphaned no-cwd log remains to delete')
  assert.equal(all.kept, 2)
}
assert.ok(!exists(root, '_no-cwd', 'session-orphan-5555'), 'orphan log removed')
assert.ok(exists(root, '--Users-test-ws--', 'session-live-3333'), 'live log survives clear-all')

// ---- workspace resolution failures ------------------------------------------

const unknown = await receiver.preview({ workspaceTitle: 'nope', titleOccurrence: 0 })
assert.equal(unknown.ok, false)
if (!unknown.ok) assert.match(unknown.error, /no workspace named/)

const occurrence = await receiver.preview({ workspaceTitle: 'ws', titleOccurrence: 5 })
assert.equal(occurrence.ok, false)
if (!occurrence.ok) assert.match(occurrence.error, /not registered/)

// ---- occurrence picks the second same-titled workspace -----------------------

const secondRoot = makeSessionsRoot()
const secondPersistence = makePersistence(secondRoot)
// ws2 owns session-aaaa-1111 in this scenario: replace its cwd rather than
// appending a duplicate id (persistence holds one header per session).
const replaced = HEADERS.map(header => header.id === 'session-aaaa-1111'
  ? { ...header, cwd: '/Users/test/ws2' }
  : header)
secondPersistence.list = async () => replaced
secondPersistence.locate = (header) => {
  const project = header.cwd === '/Users/test/ws2' ? '--Users-test-ws2--' : header.cwd === undefined ? '_no-cwd' : '--Users-test-ws--'
  return { kind: 'jsonl', path: join(secondRoot, project, header.id, 'session.jsonl.zstd') }
}
mkdirSync(join(secondRoot, '--Users-test-ws2--', 'session-aaaa-1111'), { recursive: true })
writeFileSync(join(secondRoot, '--Users-test-ws2--', 'session-aaaa-1111', 'session.jsonl.zstd'), 'stub')

const { ctx: ctx2, provided: provided2 } = makeCtx({
  sessionPersistence: secondPersistence,
  sessions: SESSIONS,
  workspaceRegistry: REGISTRY,
})
plugin.apply(ctx2)
const receiver2 = provided2.clearSessionHistory

const ws2Preview = await receiver2.preview({ workspaceTitle: 'ws', titleOccurrence: 1 })
assert.deepEqual(ws2Preview, { ok: true, targets: 1, kept: 0 }, 'occurrence 1 scopes ws2 only')

const ws2Clear = await receiver2.clear({ workspaceTitle: 'ws', titleOccurrence: 1 })
assert.equal(ws2Clear.ok, true)
if (ws2Clear.ok) assert.equal(ws2Clear.deleted, 1)
assert.ok(!exists(secondRoot, '--Users-test-ws2--', 'session-aaaa-1111'), 'ws2 log removed')
assert.ok(exists(secondRoot, '--Users-test-ws--', 'session-aaaa-1111'), 'ws1 log untouched')

// ---- degenerate locate results are refused -----------------------------------

const hostileRoot = makeSessionsRoot()
const hostilePersistence = {
  list: async () => [{ id: 'session-aaaa-1111', cwd: '/Users/test/ws' }],
  locate: () => ({ kind: 'jsonl', path: join(hostileRoot, 'not-a-session-dir') }),
}
const { ctx: ctx3, provided: provided3 } = makeCtx({
  sessionPersistence: hostilePersistence,
  sessions: { list: () => [] },
  workspaceRegistry: REGISTRY,
})
plugin.apply(ctx3)
const hostile = await provided3.clearSessionHistory.clear({ workspaceTitle: 'ws', titleOccurrence: 0 })
assert.equal(hostile.ok, true)
if (hostile.ok) assert.equal(hostile.deleted, 0, 'shape-mismatched artifact is never deleted')

// ---- missing service fails soft ----------------------------------------------

const { ctx: ctx4, provided: provided4 } = makeCtx({ sessions: SESSIONS })
plugin.apply(ctx4)
const missing = await provided4.clearSessionHistory.preview({ workspaceTitle: '', titleOccurrence: 0 })
assert.equal(missing.ok, false)
if (!missing.ok) assert.match(missing.error, /sessionPersistence/)

rmSync(root, { recursive: true, force: true })
rmSync(secondRoot, { recursive: true, force: true })
rmSync(hostileRoot, { recursive: true, force: true })

console.log('smoke: all assertions passed')

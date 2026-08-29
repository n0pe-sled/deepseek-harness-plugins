/**
 * Host-half smoke test for dsh-clear-session-history, run without the harness.
 *
 * Exercises the plugin against a stubbed Cordis context and a temp sessions
 * root (never the real $DSH_HOME):
 *   - name / inject contract;
 *   - apply() wiring: receiver registration, typert contribution;
 *   - preview/clear scoped to one workspace: every log in the workspace is
 *     deleted (attached-but-idle sessions included, archived to hide their
 *     rows); a fully cleared workspace is removed from the registry;
 *   - clear-all: orphaned no-cwd logs go, every remaining workspace
 *     registration is removed;
 *   - running protection: with an agents service present, a workspace scan
 *     keeps the actively running session (and would keep its subagents);
 *   - workspace resolution: unknown titles fail soft, occurrence picks the
 *     right row among same-titled workspaces;
 *   - a partial clear (unresolvable logs) never removes the workspace;
 *   - missing-service failures fail soft.
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

/** Persistence stub resolving artifact paths inside the fake root. list()
 * re-reads the disk mirror the real backend does, so deleted logs drop out. */
function makePersistence(root) {
  const dirFor = (header) => {
    const project = header.cwd === undefined ? '_no-cwd' : '--Users-test-ws--'
    return join(root, project, header.id)
  }
  const logPath = header => join(dirFor(header), 'session.jsonl.zstd')
  return {
    list: async () => HEADERS.filter(header => existsSync(logPath(header))),
    locate: header => ({ kind: 'jsonl', path: logPath(header) }),
  }
}

const SESSIONS = { list: () => [{ id: 'session-live-3333' }] }

/** Mutable workspace registry stub tracking deletions. */
function makeRegistry(workspaces) {
  const deleted = new Set()
  const archived = new Set()
  return {
    deleted,
    archived,
    list: () => workspaces.filter(ws => !deleted.has(ws.id)),
    delete: async (id) => {
      if (deleted.has(id)) return false
      deleted.add(id)
      return true
    },
    archiveSession: async (id) => { archived.add(id) },
  }
}
const WORKSPACES = [
  { id: 'ws-1', path: '/Users/test/ws', title: 'ws' },
  { id: 'ws-2', path: '/Users/test/ws2', title: 'ws' },
]

const exists = (root, ...parts) => existsSync(join(root, ...parts))

// ---- Contract ------------------------------------------------------------

assert.equal(typeof plugin.apply, 'function')
assert.equal(plugin.name, 'clear-session-history')
assert.deepEqual([...plugin.inject].sort(), ['sessionPersistence', 'sessions', 'typert', 'workspaceRegistry'])

// ---- apply wiring ---------------------------------------------------------

const root = makeSessionsRoot()
const registry = makeRegistry([...WORKSPACES])
const { ctx, provided, contributions } = makeCtx({
  sessionPersistence: makePersistence(root),
  sessions: SESSIONS,
  workspaceRegistry: registry,
})
plugin.apply(ctx)

const receiver = provided.clearSessionHistory
assert.ok(receiver, 'receiver must be provided under the service key')
assert.equal(contributions.length, 1, 'exactly one typert contribution')
assert.deepEqual(
  contributions[0].invocations.map(d => d.method).sort(),
  ['clear', 'clearSession', 'preview', 'previewSession'],
)

// ---- preview scoped to one workspace ---------------------------------------

const wsInput = { workspaceTitle: 'ws', titleOccurrence: 0 }
const preview = await receiver.preview(wsInput)
assert.deepEqual(preview, { ok: true, targets: 4, kept: 0 }, 'no agents service: every ws log is a target, attached-idle included')
assert.ok(exists(root, '--Users-test-ws--', 'session-aaaa-1111'), 'preview deletes nothing')
assert.equal(registry.deleted.size, 0, 'preview removes no workspace')

// ---- workspace resolution failures ------------------------------------------

const unknown = await receiver.preview({ workspaceTitle: 'nope', titleOccurrence: 0 })
assert.equal(unknown.ok, false)
if (!unknown.ok) assert.match(unknown.error, /no workspace named/)

const occurrence = await receiver.preview({ workspaceTitle: 'ws', titleOccurrence: 5 })
assert.equal(occurrence.ok, false)
if (!occurrence.ok) assert.match(occurrence.error, /not registered/)

// ---- clear scoped to one workspace -----------------------------------------

const cleared = await receiver.clear(wsInput)
assert.equal(cleared.ok, true)
if (cleared.ok) {
  assert.equal(cleared.deleted, 4, 'every ws log deleted, attached-idle included')
  assert.equal(cleared.kept, 0)
  assert.equal(cleared.removed, 1, 'the fully cleared workspace is removed from the registry')
}
assert.ok(!exists(root, '--Users-test-ws--', 'session-aaaa-1111'), 'cold log removed')
assert.ok(!exists(root, '--Users-test-ws--', 'session-bbbb-2222'), 'cold log removed')
assert.ok(!exists(root, '--Users-test-ws--', 'session-live-3333'), 'attached-but-idle log removed')
assert.ok(!exists(root, '--Users-test-ws--', 'session-sub-4444'), 'its cold subagent log removed')
assert.ok(registry.archived.has('session-live-3333'), 'attached session archived to hide its row')
assert.ok(!registry.archived.has('session-aaaa-1111'), 'cold sessions need no archive')
assert.ok(registry.deleted.has('ws-1'), 'workspace ws-1 registration removed')
assert.ok(!registry.deleted.has('ws-2'), 'the other workspace stays registered')

// ---- clear-all --------------------------------------------------------------

const all = await receiver.clear({ workspaceTitle: '', titleOccurrence: 0 })
assert.equal(all.ok, true)
if (all.ok) {
  assert.equal(all.deleted, 1, 'only the orphaned no-cwd log remains to delete')
  assert.equal(all.kept, 0)
  assert.equal(all.removed, 1, 'the remaining workspace registration is removed')
}
assert.ok(!exists(root, '_no-cwd', 'session-orphan-5555'), 'orphan log removed')
assert.ok(registry.deleted.has('ws-2'), 'workspace ws-2 registration removed by clear-all')

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

const registry2 = makeRegistry([...WORKSPACES])
const { ctx: ctx2, provided: provided2 } = makeCtx({
  sessionPersistence: secondPersistence,
  sessions: SESSIONS,
  workspaceRegistry: registry2,
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
assert.ok(registry2.deleted.has('ws-2'), 'occurrence 1 removed ws-2')
assert.ok(!registry2.deleted.has('ws-1'), 'occurrence 1 left ws-1 registered')

// ---- degenerate locate results are refused (partial clear keeps workspace) ----

const hostileRoot = makeSessionsRoot()
const hostilePersistence = {
  list: async () => [{ id: 'session-aaaa-1111', cwd: '/Users/test/ws' }],
  locate: () => ({ kind: 'jsonl', path: join(hostileRoot, 'not-a-session-dir') }),
}
const hostileRegistry = makeRegistry([...WORKSPACES])
const { ctx: ctx3, provided: provided3 } = makeCtx({
  sessionPersistence: hostilePersistence,
  sessions: { list: () => [] },
  workspaceRegistry: hostileRegistry,
})
plugin.apply(ctx3)
const hostile = await provided3.clearSessionHistory.clear({ workspaceTitle: 'ws', titleOccurrence: 0 })
assert.equal(hostile.ok, true)
if (hostile.ok) {
  assert.equal(hostile.deleted, 0, 'shape-mismatched artifact is never deleted')
  assert.equal(hostile.removed, 0, 'a partial clear never removes the workspace')
}
assert.equal(hostileRegistry.deleted.size, 0, 'no workspace registration touched on partial clear')

// ---- single-session delete ------------------------------------------------

const sessRoot = makeSessionsRoot()
const sessRegistry = makeRegistry([...WORKSPACES])
const sessPersistence = makePersistence(sessRoot)
// A session whose agent is actively running must be refused.
mkdirSync(join(sessRoot, '--Users-test-ws--', 'session-running-9999'), { recursive: true })
writeFileSync(join(sessRoot, '--Users-test-ws--', 'session-running-9999', 'session.jsonl.zstd'), 'stub')
sessPersistence.list = async () => [
  ...HEADERS,
  { id: 'session-running-9999', cwd: '/Users/test/ws' },
].filter(header => {
  const project = header.cwd === undefined ? join(sessRoot, '_no-cwd') : join(sessRoot, '--Users-test-ws--')
  return existsSync(join(project, header.id, 'session.jsonl.zstd'))
})
const agents = { get: id => (id === 'session-running-9999' ? { status: 'running' } : undefined) }
const { ctx: ctxS, provided: providedS } = makeCtx({
  sessionPersistence: sessPersistence,
  sessions: SESSIONS,
  workspaceRegistry: sessRegistry,
  agents,
})
plugin.apply(ctxS)
const sessionsReceiver = providedS.clearSessionHistory

// Workspace scan with an agents service: the actively running session is the
// only kept log; everything else (attached-idle, cold, subagent-of-idle) is a
// target. Preview only — the dirs are needed by the single-session tests below.
const wsRunningPreview = await sessionsReceiver.preview(wsInput)
assert.deepEqual(wsRunningPreview, { ok: true, targets: 4, kept: 1 }, 'workspace scan keeps only the running session')

const noSuchPreview = await sessionsReceiver.previewSession({ sessionId: 'session-nope-9999' })
assert.equal(noSuchPreview.ok, false)
if (!noSuchPreview.ok) assert.match(noSuchPreview.error, /no session/)

const noSuchClear = await sessionsReceiver.clearSession({ sessionId: 'session-nope-9999' })
assert.equal(noSuchClear.ok, false)

// Cold session: deleted, no archive (nothing lingers for the host).
const coldPreview = await sessionsReceiver.previewSession({ sessionId: 'session-aaaa-1111' })
assert.deepEqual(coldPreview, { ok: true, targets: 1, kept: 0 }, 'cold session is deletable')
const coldClear = await sessionsReceiver.clearSession({ sessionId: 'session-aaaa-1111' })
assert.equal(coldClear.ok, true)
if (coldClear.ok) {
  assert.equal(coldClear.deleted, 1)
  assert.equal(coldClear.removed, 0, 'a single-session delete never removes a workspace')
}
assert.ok(!exists(sessRoot, '--Users-test-ws--', 'session-aaaa-1111'), 'cold session dir removed')
assert.ok(!sessRegistry.archived.has('session-aaaa-1111'), 'cold delete needs no archive')
assert.equal(sessRegistry.deleted.size, 0, 'no workspace registration touched by a session delete')

// Attached-but-idle session: deletable now; archived so the host-still-held
// row leaves the sidebar.
const livePreview = await sessionsReceiver.previewSession({ sessionId: 'session-live-3333' })
assert.deepEqual(livePreview, { ok: true, targets: 1, kept: 0 }, 'attached-but-idle session is deletable')
const liveClear = await sessionsReceiver.clearSession({ sessionId: 'session-live-3333' })
assert.equal(liveClear.ok, true)
if (liveClear.ok) assert.equal(liveClear.deleted, 1)
assert.ok(!exists(sessRoot, '--Users-test-ws--', 'session-live-3333'), 'attached idle log removed')
assert.ok(sessRegistry.archived.has('session-live-3333'), 'attached delete hides the row via archive')

// Cold subagent of an attached-but-idle parent: also deletable.
const subPreview = await sessionsReceiver.previewSession({ sessionId: 'session-sub-4444' })
assert.deepEqual(subPreview, { ok: true, targets: 1, kept: 0 })
const subClear = await sessionsReceiver.clearSession({ sessionId: 'session-sub-4444' })
assert.equal(subClear.ok, true)
assert.ok(!exists(sessRoot, '--Users-test-ws--', 'session-sub-4444'), 'idle subagent log removed')

// Actively running session: refused, log untouched.
const runningPreview = await sessionsReceiver.previewSession({ sessionId: 'session-running-9999' })
assert.deepEqual(runningPreview, { ok: true, targets: 0, kept: 1 }, 'running session is not deletable yet')
const runningClear = await sessionsReceiver.clearSession({ sessionId: 'session-running-9999' })
assert.equal(runningClear.ok, false)
if (!runningClear.ok) assert.match(runningClear.error, /running/)
assert.ok(exists(sessRoot, '--Users-test-ws--', 'session-running-9999'), 'running log untouched')

const orphanClear = await sessionsReceiver.clearSession({ sessionId: 'session-orphan-5555' })
assert.equal(orphanClear.ok, true)
if (orphanClear.ok) assert.equal(orphanClear.deleted, 1)
assert.ok(!exists(sessRoot, '_no-cwd', 'session-orphan-5555'), 'no-cwd session dir removed')

// ---- missing service fails soft ----------------------------------------------

const { ctx: ctx4, provided: provided4 } = makeCtx({ sessions: SESSIONS })
plugin.apply(ctx4)
const missing = await provided4.clearSessionHistory.preview({ workspaceTitle: '', titleOccurrence: 0 })
assert.equal(missing.ok, false)
if (!missing.ok) assert.match(missing.error, /sessionPersistence/)

rmSync(root, { recursive: true, force: true })
rmSync(secondRoot, { recursive: true, force: true })
rmSync(hostileRoot, { recursive: true, force: true })
rmSync(sessRoot, { recursive: true, force: true })

console.log('smoke: all assertions passed')

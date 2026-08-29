/**
 * Host (Node) half of the Clear Session History plugin.
 *
 * Deletes session logs from disk under the sessions root, scoped either to one
 * workspace (matched by display title, resolved through `workspaceRegistry`)
 * or to every workspace at once. The on-disk layout comes from the configured
 * session persistence backend: each materialized session owns one directory
 * (`<root>/<projectKey>/<sessionId>/`), which the backend's `locate()` resolves
 * without guessing at the project-slug algorithm.
 *
 * Safety model — the persistence service is append-only and knows nothing
 * about this plugin, so the rules here err toward keeping data:
 *   - A session that is live in the running host (`sessions` store) is never
 *     deleted; deleting an attached log underneath its writer would leave a
 *     recreated, headerless file.
 *   - A cold subagent log whose parent lineage reaches a live session is kept
 *     too (fixpoint over `parentSession` chains), so an open session's
 *     trajectory replay stays intact.
 *   - A directory is only removed when its basename equals the session id and
 *     its parent matches the backend's project-key shape, so a degenerate
 *     `locate()` result can never widen into a recursive wipe.
 *
 * Registry bookkeeping needs no surgery: `workspace.list` rows keep stale
 * session ids, but the sidebar joins membership against `session.list` (read
 * fresh from persistence) and skips ids without a summary, so deleted
 * sessions disappear from the tree; the stale ids are filtered on the next
 * host start and remain invisible until then.
 *
 * All actions flow through a runtime-registered Typert endpoint
 * (`clearSessionHistory`) consumed by the browser half; `preview` returns the
 * same scope `clear` would act on, and both refuse to throw — failures come
 * back as `{ ok: false, error }` outcomes.
 */

import { realpath, rm, stat, rmdir } from 'node:fs/promises'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-typert-registry'
import type { TypertContribution, TypertPackageModel } from '@deepseek-ai/dsh-typert-registry'
import { bindTypertRemote, type TypertGatewayBinding } from '@deepseek-ai/dsh-typert-protocol'
import { DESCRIPTORS, SERVICE } from './shared/remote.ts'
import type { ClearOutcome, ClearScopeInput, PreviewOutcome } from './shared/remote.ts'

export const name = 'clear-session-history'

/** Services that must be mounted before this plugin runs. */
export const inject = ['sessionPersistence', 'sessions', 'workspaceRegistry', 'typert']

// ---- Duck-typed service faces -------------------------------------------
//
// Everything below mirrors the structural surface this plugin actually uses,
// so the node half carries no compile-time dependency on the host packages
// (they are resolved at runtime through the profile's node_modules fallback).

/** The slice of a session header this plugin reads. */
interface SessionHeaderLike {
  readonly id: string
  readonly cwd?: string
  readonly origin?: 'subagent'
  readonly parentSession?: string
}

/** The slice of the session persistence backend this plugin calls. */
interface PersistenceLike {
  list(): Promise<readonly SessionHeaderLike[]>
  locate(meta: SessionHeaderLike): { readonly kind: string; readonly path: string } | undefined
}

/** The slice of the live session store this plugin reads. */
interface SessionsLike {
  list(): readonly { readonly id: string }[]
}

/** The slice of the workspace registry this plugin reads. */
interface RegistryLike {
  list(): readonly { readonly id: string; readonly path: string; readonly title: string }[]
}

/** Minimal logger face (present on the host composition). */
interface LoggerLike {
  info?(message: string, ...args: unknown[]): void
  warn?(message: string, ...args: unknown[]): void
}

/** Fetch one service by name. */
function service<T>(ctx: Context, key: string): T | undefined {
  return (ctx as unknown as { get(name: string): unknown }).get(key) as T | undefined
}

/** Log through the host logger when present, containing every failure. */
function makeLogger(ctx: Context): { info(message: string, ...args: unknown[]): void; warn(message: string, ...args: unknown[]): void } {
  const logger = (ctx as unknown as { logger?: LoggerLike }).logger
  return {
    info: (message, ...args) => { logger?.info?.(message, ...args) },
    warn: (message, ...args) => { logger?.warn?.(message, ...args) },
  }
}

/** Canonicalize a path the way the host does; fall back to resolve when the
 * path does not exist (a session cwd may point at a removed directory). */
async function canonicalize(raw: string): Promise<string> {
  try {
    return await realpath(raw)
  } catch {
    return path.resolve(raw)
  }
}

/** One receiver the gateway dispatches `/api/clearSessionHistory/*` to. */
interface ClearSessionHistoryReceiver {
  typertRemote: TypertGatewayBinding<ClearSessionHistoryReceiver>
  preview(input: ClearScopeInput): Promise<PreviewOutcome>
  clear(input: ClearScopeInput): Promise<ClearOutcome>
}

/** Empty model for the Typert contribution: no generated reflection is claimed. */
const EMPTY_MODEL: TypertPackageModel = { services: [], events: [], objects: [] }

export function apply(ctx: Context): void {
  const log = makeLogger(ctx)

  /** Resolve the duck-typed services or return a failure message. */
  const resolveServices = (): {
    persistence: PersistenceLike
    sessions: SessionsLike
    registry: RegistryLike
  } | { error: string } => {
    const persistence = service<PersistenceLike>(ctx, 'sessionPersistence')
    const sessions = service<SessionsLike>(ctx, 'sessions')
    const registry = service<RegistryLike>(ctx, 'workspaceRegistry')
    if (persistence === undefined) return { error: 'the sessionPersistence service is not available in this composition' }
    if (sessions === undefined) return { error: 'the sessions service is not available in this composition' }
    if (registry === undefined) return { error: 'the workspaceRegistry service is not available in this composition' }
    return { persistence, sessions, registry }
  }

  /**
   * Sessions that must survive any clear: every live session plus, by
   * fixpoint over `parentSession` chains, every cold subagent whose ancestry
   * reaches a live session.
   */
  const protectedIds = async (persistence: PersistenceLike, sessions: SessionsLike): Promise<Set<string>> => {
    const headers = await persistence.list()
    const live = new Set<string>(sessions.list().map(session => session.id))
    let grew = true
    while (grew) {
      grew = false
      for (const header of headers) {
        if (live.has(header.id)) continue
        if (header.origin !== 'subagent') continue
        const parent = header.parentSession
        if (parent !== undefined && live.has(parent)) {
          live.add(header.id)
          grew = true
        }
      }
    }
    return live
  }

  /**
   * The session directory a header's backend artifact lives in, or null when
   * the shape does not look like one session's owned directory.
   */
  const sessionDirOf = (header: SessionHeaderLike, artifactPath: string): string | null => {
    const dir = path.dirname(artifactPath)
    if (path.basename(dir) !== header.id) return null
    const project = path.dirname(dir)
    const projectSeg = path.basename(project)
    const shaped = projectSeg === '_no-cwd'
      || (projectSeg.startsWith('--') && projectSeg.endsWith('--') && projectSeg.length > 4)
    if (!shaped) return null
    const root = path.dirname(project)
    if (path.dirname(root) === root) return null // refuse a filesystem-root neighbor
    return dir
  }

  /**
   * Compute the clear scope once, shared by preview and clear: which headers
   * would be deleted (`targets`) and which are kept inside the scope (`kept`).
   * `workspace === undefined` scans every workspace; otherwise only headers
   * whose canonical cwd equals the workspace's canonical path are in scope —
   * the same membership rule the registry applies.
   */
  const scanScope = async (
    persistence: PersistenceLike,
    sessions: SessionsLike,
    workspace: { readonly path: string } | undefined,
  ): Promise<{ targets: readonly SessionHeaderLike[]; kept: number }> => {
    const headers = await persistence.list()
    const protectedSet = await protectedIds(persistence, sessions)
    const workspacePath = workspace === undefined ? undefined : await canonicalize(workspace.path)
    const targets: SessionHeaderLike[] = []
    let kept = 0
    for (const header of headers) {
      if (workspacePath !== undefined) {
        if (header.cwd === undefined) continue
        const cwd = await canonicalize(header.cwd)
        if (cwd !== workspacePath) continue
      }
      if (protectedSet.has(header.id)) {
        kept += 1
      } else {
        targets.push(header)
      }
    }
    return { targets, kept }
  }

  /** Resolve the scope's workspace row (or undefined for "all workspaces"). */
  const resolveWorkspace = (
    registry: RegistryLike,
    input: ClearScopeInput,
  ): { workspace?: { readonly path: string }; error?: string } => {
    if (input.workspaceTitle === '') return {}
    const matches = registry.list().filter(workspace => workspace.title === input.workspaceTitle)
    const workspace = matches[input.titleOccurrence]
    if (workspace === undefined) {
      return { error: matches.length === 0
        ? `no workspace named "${input.workspaceTitle}" is registered`
        : `workspace "${input.workspaceTitle}" #${input.titleOccurrence + 1} is not registered (${matches.length} share that title)` }
    }
    return { workspace }
  }

  /** Delete one target's directory after re-checking the shape on disk. */
  const deleteSessionDir = async (header: SessionHeaderLike, persistence: PersistenceLike): Promise<boolean> => {
    const location = persistence.locate(header)
    if (location === undefined) return false
    const dir = sessionDirOf(header, location.path)
    if (dir === null) return false
    try {
      if (!(await stat(dir)).isDirectory()) return false
      await rm(dir, { recursive: true, force: true })
      return true
    } catch (error) {
      log.warn('[clear-session-history] failed to remove %s: %s', dir, error instanceof Error ? error.message : String(error))
      return false
    }
  }

  /** Remove a project directory once it is empty (tidy, best effort). */
  const pruneEmptyProjectDir = async (projectDir: string): Promise<void> => {
    try {
      await rmdir(projectDir) // fails with ENOTEMPTY when sessions remain
    } catch {
      // Not empty (or already gone): nothing to prune.
    }
  }

  /** Prepare one call: resolve services and the scope's workspace row. */
  type Prepared = {
    ok: true
    persistence: PersistenceLike
    sessions: SessionsLike
    workspace?: { readonly path: string }
  } | { ok: false; error: string }

  const prepare = (input: ClearScopeInput): Prepared => {
    const services = resolveServices()
    if ('error' in services) return { ok: false, error: services.error }
    const resolved = resolveWorkspace(services.registry, input)
    if (resolved.error !== undefined) return { ok: false, error: resolved.error }
    if (resolved.workspace === undefined) {
      return { ok: true, persistence: services.persistence, sessions: services.sessions }
    }
    return { ok: true, persistence: services.persistence, sessions: services.sessions, workspace: resolved.workspace }
  }

  /** Counts only: what a clear would delete for this scope, nothing touched. */
  const preview = async (input: ClearScopeInput): Promise<PreviewOutcome> => {
    const prepared = prepare(input)
    if (!prepared.ok) return { ok: false, error: prepared.error }
    try {
      const scope = await scanScope(prepared.persistence, prepared.sessions, prepared.workspace)
      return { ok: true, targets: scope.targets.length, kept: scope.kept }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** Delete every target's session directory inside the scope. */
  const clear = async (input: ClearScopeInput): Promise<ClearOutcome> => {
    const prepared = prepare(input)
    if (!prepared.ok) return { ok: false, error: prepared.error }
    const { persistence, sessions, workspace } = prepared
    try {
      const scope = await scanScope(persistence, sessions, workspace)
      const touchedProjects = new Set<string>()
      let deleted = 0
      let unresolved = 0
      for (const header of scope.targets) {
        const location = persistence.locate(header)
        const dir = location === undefined ? null : sessionDirOf(header, location.path)
        if (dir === null) {
          unresolved += 1
          continue
        }
        if (await deleteSessionDir(header, persistence)) {
          deleted += 1
          touchedProjects.add(path.dirname(dir))
        } else {
          unresolved += 1
        }
      }
      // Prune project directories this clear emptied. Remaining headers
      // (any workspace) keep their project dir alive.
      if (touchedProjects.size > 0) {
        const remainingProjects = new Set<string>()
        for (const header of await persistence.list()) {
          const location = persistence.locate(header)
          if (location !== undefined) {
            remainingProjects.add(path.dirname(path.dirname(location.path)))
          }
        }
        for (const project of touchedProjects) {
          if (!remainingProjects.has(project)) await pruneEmptyProjectDir(project)
        }
      }
      log.info(
        '[clear-session-history] cleared %d session log(s) (kept %d, unresolved %d, scope %s)',
        deleted, scope.kept, unresolved, workspace === undefined ? 'all workspaces' : `"${input.workspaceTitle}"`,
      )
      return { ok: true, deleted, targets: scope.targets.length, kept: scope.kept }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  const receiver: ClearSessionHistoryReceiver = {
    typertRemote: undefined as unknown as TypertGatewayBinding<ClearSessionHistoryReceiver>,
    preview,
    clear,
  }
  receiver.typertRemote = bindTypertRemote(receiver, SERVICE, { namespace: SERVICE })
  // A plain provided object resolves through the gateway's receiver lookup
  // (`receiverContext.get(service)`); the binding only needs to be consistent.
  ctx.provide(SERVICE, receiver)

  // Register the endpoints so the gateway claims `/api/clearSessionHistory/<method>`.
  const contribution: TypertContribution = {
    package: 'dsh-clear-session-history',
    face: 'host',
    schemas: [],
    model: EMPTY_MODEL,
    invocations: [...DESCRIPTORS],
  }
  ctx.typert.register(contribution)
}

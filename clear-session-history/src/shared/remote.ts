/**
 * Wire contract between the two halves of the Clear Session History plugin:
 * the RPC method invocation descriptors, payload types, and boundary
 * validators.
 *
 * This module is deliberately dependency-free at runtime (pure JSON-safe data
 * plus tiny hand-rolled validators), because it is bundled into BOTH halves:
 * the node half (host registration) and the browser half (client `$mount`).
 * The client's Remote `$mount` requires strict codecs, so every descriptor
 * uses `{ mode: 'strict', schema }` with these validators.
 *
 * One service, `clearSessionHistory`, exposes four methods:
 *   - preview(input)       → how many session logs a workspace/all clear would delete / keep
 *   - clear(input)         → delete those session logs from disk (except kept ones)
 *   - previewSession(input) → whether a single session's log is deletable
 *   - clearSession(input)  → delete one session's log from disk
 *
 * `input.workspaceTitle === ''` means every workspace; a non-empty title
 * targets the `titleOccurrence`-th workspace with that display title (titles
 * are unique per registry rename rules, but `create` allows basenames to
 * collide, so the occurrence index disambiguates in registry display order —
 * the same order the sidebar renders). The session methods target a single
 * session by id.
 *
 * @module dsh-clear-session-history/remote
 */

import type {
  InvocationDescriptor,
  RemoteResult,
  TypertSchema,
} from '@deepseek-ai/dsh-typert-protocol'

/** Which session logs one workspace/all call addresses. */
export interface ClearScopeInput {
  /** Workspace display title, or `''` for every workspace. */
  readonly workspaceTitle: string
  /** 0-based index among the registry workspaces sharing that title. */
  readonly titleOccurrence: number
}

/** Which session a single-session delete addresses. */
export interface SessionScopeInput {
  /** The session id (the sidebar resolves it from the row being acted on). */
  readonly sessionId: string
}

/** Session-log counts shared by preview and clear outcomes. */
export interface ClearCounts {
  /** Session logs the call deletes (or would delete). */
  readonly targets: number
  /** Session logs inside the scope that are kept (currently open or needed by an open session). */
  readonly kept: number
}

/** Result of preview: counts, or a soft failure (unknown workspace, missing service). */
export type PreviewOutcome =
  | { readonly ok: true; readonly targets: number; readonly kept: number }
  | { readonly ok: false; readonly error: string }

/** Result of clear: how many logs were removed, the kept count, and how many
 * workspace registrations were dropped when the clear emptied them. */
export type ClearOutcome =
  | ({ readonly ok: true; readonly deleted: number; readonly removed: number } & ClearCounts)
  | { readonly ok: false; readonly error: string }

/** Client-side unwrapped result of one Remote call. */
export type RemoteCallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

// ---- Service identity ---------------------------------------------------

/** Cordis service key of the receiver, also the wire namespace. */
export const SERVICE = 'clearSessionHistory'

const PREFIX = `dsh-clear-session-history#${SERVICE}.`

// ---- Boundary validators -------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function isNatural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parseClearScopeInput(value: unknown): ClearScopeInput {
  if (!isRecord(value) || typeof value.workspaceTitle !== 'string' || !isNatural(value.titleOccurrence)) {
    throw new TypeError('clear scope input must be a plain object with a string workspaceTitle and a natural titleOccurrence')
  }
  return { workspaceTitle: value.workspaceTitle, titleOccurrence: value.titleOccurrence }
}

function parseSessionScopeInput(value: unknown): SessionScopeInput {
  if (!isRecord(value) || typeof value.sessionId !== 'string' || value.sessionId.trim() === '') {
    throw new TypeError('session scope input must be a plain object with a non-empty sessionId string')
  }
  return { sessionId: value.sessionId }
}

function parseClearCounts(value: unknown): ClearCounts {
  if (!isRecord(value) || !isNatural(value.targets) || !isNatural(value.kept)) {
    throw new TypeError('clear counts must be a plain object with natural targets and kept')
  }
  return { targets: value.targets, kept: value.kept }
}

function parsePreviewOutcome(value: unknown): PreviewOutcome {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    throw new TypeError('preview outcome must be a plain object with ok')
  }
  if (value.ok) {
    const counts = parseClearCounts(value)
    return { ok: true, targets: counts.targets, kept: counts.kept }
  }
  if (typeof value.error !== 'string') throw new TypeError('preview outcome error must be a string')
  return { ok: false, error: value.error }
}

function parseClearOutcome(value: unknown): ClearOutcome {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    throw new TypeError('clear outcome must be a plain object with ok')
  }
  if (value.ok) {
    if (!isNatural(value.deleted) || !isNatural(value.removed)) {
      throw new TypeError('clear outcome ok result must carry natural deleted and removed counts')
    }
    const counts = parseClearCounts(value)
    return { ok: true, deleted: value.deleted, removed: value.removed, targets: counts.targets, kept: counts.kept }
  }
  if (typeof value.error !== 'string') throw new TypeError('clear outcome error must be a string')
  return { ok: false, error: value.error }
}

// ---- Descriptors ---------------------------------------------------------

type TypertSchemaBoundary<T> = TypertSchema<T>

const CLEAR_SCOPE_INPUT_SCHEMA: TypertSchemaBoundary<ClearScopeInput> = { parse: parseClearScopeInput }
const SESSION_SCOPE_INPUT_SCHEMA: TypertSchemaBoundary<SessionScopeInput> = { parse: parseSessionScopeInput }
const PREVIEW_OUTCOME_SCHEMA: TypertSchemaBoundary<PreviewOutcome> = { parse: parsePreviewOutcome }
const CLEAR_OUTCOME_SCHEMA: TypertSchemaBoundary<ClearOutcome> = { parse: parseClearOutcome }

/** The one descriptor each method needs: generated-style identity + strict codecs. */
function descriptor<R>(
  method: string,
  result: TypertSchemaBoundary<R>,
  inputSchema: TypertSchemaBoundary<ClearScopeInput | SessionScopeInput> = CLEAR_SCOPE_INPUT_SCHEMA,
): InvocationDescriptor {
  return {
    id: `${PREFIX}${method}`,
    service: SERVICE,
    namespace: SERVICE,
    method,
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'input',
      wire: 'input',
      source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: `dsh-clear-session-history#${method}Input`,
        schema: inputSchema,
      },
    }],
    result: { mode: 'strict', typeSymbol: `dsh-clear-session-history#${method}`, schema: result },
  }
}

export const DESCRIPTORS: readonly InvocationDescriptor[] = [
  descriptor('preview', PREVIEW_OUTCOME_SCHEMA),
  descriptor('clear', CLEAR_OUTCOME_SCHEMA),
  descriptor('previewSession', PREVIEW_OUTCOME_SCHEMA, SESSION_SCOPE_INPUT_SCHEMA),
  descriptor('clearSession', CLEAR_OUTCOME_SCHEMA, SESSION_SCOPE_INPUT_SCHEMA),
]

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'clearSessionHistory/preview'(input: ClearScopeInput): Promise<RemoteResult<PreviewOutcome>>
    'clearSessionHistory/clear'(input: ClearScopeInput): Promise<RemoteResult<ClearOutcome>>
    'clearSessionHistory/previewSession'(input: SessionScopeInput): Promise<RemoteResult<PreviewOutcome>>
    'clearSessionHistory/clearSession'(input: SessionScopeInput): Promise<RemoteResult<ClearOutcome>>
  }
  interface TypertRemoteNamespaceMap {
    clearSessionHistory: {
      preview(input: ClearScopeInput): Promise<RemoteResult<PreviewOutcome>>
      clear(input: ClearScopeInput): Promise<RemoteResult<ClearOutcome>>
      previewSession(input: SessionScopeInput): Promise<RemoteResult<PreviewOutcome>>
      clearSession(input: SessionScopeInput): Promise<RemoteResult<ClearOutcome>>
    }
  }
}

/**
 * The confirm dialog for both clear actions: a checkbox-gated RiskConfirmation
 * fed by a live host-side count, so the user sees exactly how many session
 * logs a clear would delete before acknowledging.
 *
 * The component runs on the plugin's own React root (no slot registration);
 * the plugin body drives it through the imperative {@link DialogApi} handle
 * registered on mount, and every host interaction arrives as a plain callback
 * prop — the component never sees ctx.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { RiskConfirmation } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ClearCounts, ClearOutcome, ClearScopeInput, PreviewOutcome, RemoteCallOutcome, SessionScopeInput,
} from '../shared/remote.ts'

/** A clear call's payload for this mode: workspace scope or a single session. */
export type ClearCallInput = ClearScopeInput | SessionScopeInput

/** What the augmentation asks the dialog to show. */
export interface ClearDialogRequest {
  mode: 'workspace' | 'all' | 'session'
  workspaceTitle: string
  titleOccurrence: number
  /** session mode only: the resolved session id (deleted by the host). */
  sessionId?: string
  /** session mode only: the session's display title. */
  sessionTitle?: string
}

/** Imperative handle the plugin body holds. */
export interface DialogApi {
  open(request: ClearDialogRequest): void
}

interface ClearHistoryDialogProps {
  /** Called once on mount with the imperative handle. */
  register(api: DialogApi): void
  /** Host-side count of what a clear would delete (nothing touched). */
  onPreview(mode: ClearDialogRequest['mode'], input: ClearCallInput): Promise<RemoteCallOutcome<PreviewOutcome>>
  /** The destructive call itself. */
  onClear(mode: ClearDialogRequest['mode'], input: ClearCallInput): Promise<RemoteCallOutcome<ClearOutcome>>
  /** Fired after a fully successful clear: the plugin reloads so the fresh
   * session and workspace lists reflect the deletion. */
  onSuccess(): void
  /** Fired after a partial clear so the sidebar gets a best-effort refresh. */
  onCleared(): void
}

/** A preview that never arrived (host unavailable, request lost). */
const EMPTY_COUNTS: ClearCounts = { targets: 0, kept: 0 }

/** The wire payload for a request: a session id for single deletes, else the
 * workspace scope (empty title = every workspace). */
function buildInput(request: ClearDialogRequest): ClearCallInput | null {
  if (request.mode === 'session') {
    if (request.sessionId === undefined) return null
    return { sessionId: request.sessionId }
  }
  return {
    workspaceTitle: request.mode === 'workspace' ? request.workspaceTitle : '',
    titleOccurrence: request.titleOccurrence,
  }
}

/** The acknowledgement line, wording the workspace removal per mode. */
function resolveAcknowledge(
  counts: ClearCounts,
  pending: boolean,
  failed: boolean,
  nothing: boolean,
  mode: ClearDialogRequest['mode'],
): string {
  if (nothing || pending || failed) return 'I understand this action deletes session logs from disk.'
  if (mode === 'session') {
    return 'I understand this session log will be permanently deleted from disk.'
  }
  const removal = mode === 'workspace'
    ? 'the workspace is removed from the sidebar'
    : 'every workspace is removed from the sidebar'
  return counts.targets === 1
    ? `I understand this 1 session log is permanently deleted and ${removal}.`
    : `I understand these ${counts.targets} session logs are permanently deleted and ${removal}.`
}

export function ClearHistoryDialog({ register, onPreview, onClear, onSuccess, onCleared }: ClearHistoryDialogProps): JSX.Element {
  const [request, setRequest] = useState<ClearDialogRequest | null>(null)
  const [preview, setPreview] = useState<RemoteCallOutcome<PreviewOutcome> | null>(null)
  const [busy, setBusy] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const generation = useRef(0)

  const close = useCallback(() => {
    generation.current += 1 // invalidate any in-flight preview
    setRequest(null)
    setPreview(null)
    setBusy(false)
    setAcknowledged(false)
    setFailure(null)
    setResult(null)
  }, [])

  useEffect(() => {
    register({
      open: (next) => {
        generation.current += 1
        setRequest(next)
        setPreview(null)
        setBusy(false)
        setAcknowledged(false)
        setFailure(null)
        setResult(null)
        const input = buildInput(next)
        if (input === null) {
          setFailure('Could not identify this session in the sidebar.')
          return
        }
        const ticket = generation.current
        void onPreview(next.mode, input).then(outcome => {
          if (generation.current !== ticket) return
          setPreview(outcome)
        })
      },
    })
    // The register callback is stable; the remote closures are bound once, so
    // the effect intentionally runs exactly once.
  }, [])

  if (request === null) return <></>

  // Two envelopes to unwrap: the Remote transport outcome, then the business
  // outcome the host receiver returned.
  const counts: ClearCounts = preview !== null && preview.ok && preview.value.ok
    ? { targets: preview.value.targets, kept: preview.value.kept }
    : EMPTY_COUNTS
  const sessionName = request.sessionTitle ?? 'this session'
  const scopeLabel = request.mode === 'workspace'
    ? `"${request.workspaceTitle}"`
    : request.mode === 'session' ? `"${sessionName}"` : 'every workspace'
  const previewPending = preview === null
  const previewError = preview === null
    ? null
    : !preview.ok ? preview.error : !preview.value.ok ? preview.value.error : null
  const previewFailed = previewError !== null
  const nothingToDelete = !previewPending && !previewFailed && counts.targets === 0

  const description = (() => {
    if (previewFailed) return `Could not check the session logs on disk: ${previewError ?? 'unknown error'}`
    if (previewPending) return request.mode === 'session' ? 'Checking this session…' : 'Counting the session logs stored on disk…'
    if (nothingToDelete) {
      if (request.mode === 'session') {
        return counts.kept > 0
          ? `This session is currently running (an agent turn is in flight), so it can't be deleted yet. Try again once it finishes.`
          : `No session log was found on disk for "${sessionName}". There is nothing to delete.`
      }
      if (counts.kept > 0) {
        const keptNoun = counts.kept === 1 ? 'The only session log' : `All ${counts.kept} session logs`
        return `${keptNoun} for ${scopeLabel} belong${counts.kept === 1 ? 's' : ''} to currently running sessions, so nothing can be deleted right now. Try again once they finish.`
      }
      return `No session logs were found on disk for ${scopeLabel}. There is nothing to delete.`
    }
    if (request.mode === 'session') {
      return `This permanently deletes the session log for "${sessionName}" from disk. The workspace and its other sessions are untouched.`
    }
    const noun = counts.targets === 1 ? 'session log' : 'session logs'
    const keptNote = counts.kept > 0
      ? ` ${counts.kept} ${counts.kept === 1 ? 'log belongs' : 'logs belong'} to currently running sessions and ${counts.kept === 1 ? 'is' : 'are'} kept.`
      : ''
    const removedNote = request.mode === 'workspace'
      ? ` and removes the workspace from the sidebar`
      : ' and removes every workspace from the sidebar'
    return `This permanently deletes ${counts.targets} ${noun} from disk for ${scopeLabel}${removedNote}. Open sessions that are idle are deleted too.${keptNote}`
  })()

  const confirmLabel = previewPending || previewFailed
    ? 'Delete'
    : request.mode === 'session'
      ? 'Delete session'
      : counts.targets === 1 ? 'Delete 1 session log' : `Delete ${counts.targets} session logs`

  const confirm = (): void => {
    if (busy || request === null) return
    const input = buildInput(request)
    if (input === null) {
      setFailure('Could not identify this session in the sidebar.')
      return
    }
    setBusy(true)
    setFailure(null)
    void onClear(request.mode, input).then(outcome => {
      setBusy(false)
      if (!outcome.ok) {
        setFailure(outcome.error)
        return
      }
      const counts = outcome.value
      if (!counts.ok) {
        setFailure(counts.error)
        return
      }
      if (counts.deleted < counts.targets) {
        setResult(`Deleted ${counts.deleted} of ${counts.targets} session logs. `
          + 'The rest could not be resolved to safe on-disk directories, so the workspace was kept.')
        onCleared()
        return
      }
      onSuccess()
    })
  }

  return (
    <RiskConfirmation
      open
      title={request.mode === 'session' ? 'Delete session' : request.mode === 'workspace' ? 'Clear session history' : 'Clear All Session History'}
      description={failure !== null ? `Delete failed: ${failure}` : result !== null ? result : description}
      acknowledgeLabel={resolveAcknowledge(counts, previewPending, previewFailed, nothingToDelete, request.mode)}
      cancelLabel="Cancel"
      confirmLabel={confirmLabel}
      acknowledged={acknowledged}
      disabled={busy || previewPending || previewFailed || nothingToDelete}
      onAcknowledgedChange={setAcknowledged}
      onCancel={close}
      onConfirm={confirm}
    />
  )
}

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
import type { ClearCounts, ClearOutcome, ClearScopeInput, PreviewOutcome, RemoteCallOutcome } from '../shared/remote.ts'

/** What the augmentation asks the dialog to show. */
export interface ClearDialogRequest {
  mode: 'workspace' | 'all'
  workspaceTitle: string
  titleOccurrence: number
}

/** Imperative handle the plugin body holds. */
export interface DialogApi {
  open(request: ClearDialogRequest): void
}

interface ClearHistoryDialogProps {
  /** Called once on mount with the imperative handle. */
  register(api: DialogApi): void
  /** Host-side count of what a clear would delete (nothing touched). */
  onPreview(input: ClearScopeInput): Promise<RemoteCallOutcome<PreviewOutcome>>
  /** The destructive call itself. */
  onClear(input: ClearScopeInput): Promise<RemoteCallOutcome<ClearOutcome>>
  /** Fired after a successful clear so the sidebar can repull its list. */
  onCleared(): void
}

/** A preview that never arrived (host unavailable, request lost). */
const EMPTY_COUNTS: ClearCounts = { targets: 0, kept: 0 }

export function ClearHistoryDialog({ register, onPreview, onClear, onCleared }: ClearHistoryDialogProps): JSX.Element {
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
        const input: ClearScopeInput = {
          workspaceTitle: next.mode === 'workspace' ? next.workspaceTitle : '',
          titleOccurrence: next.titleOccurrence,
        }
        const ticket = generation.current
        void onPreview(input).then(outcome => {
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
  const scopeLabel = request.mode === 'workspace' ? `"${request.workspaceTitle}"` : 'every workspace'
  const previewPending = preview === null
  const previewError = preview === null
    ? null
    : !preview.ok ? preview.error : !preview.value.ok ? preview.value.error : null
  const previewFailed = previewError !== null
  const nothingToDelete = !previewPending && !previewFailed && counts.targets === 0

  const description = (() => {
    if (previewFailed) return `Could not count the session logs on disk: ${previewError ?? 'unknown error'}`
    if (previewPending) return 'Counting the session logs stored on disk…'
    if (nothingToDelete) return `No session logs were found on disk for ${scopeLabel}. There is nothing to delete.`
    const noun = counts.targets === 1 ? 'session log' : 'session logs'
    const keptNote = counts.kept > 0
      ? ` Sessions that are currently open (and their running subagents) are kept: ${counts.kept}.`
      : ' Sessions that are currently open are kept.'
    return `This permanently deletes ${counts.targets} ${noun} from disk for ${scopeLabel}.${keptNote}`
  })()

  const confirmLabel = previewPending || previewFailed
    ? 'Delete'
    : counts.targets === 1 ? 'Delete 1 session log' : `Delete ${counts.targets} session logs`

  const confirm = (): void => {
    if (busy || request === null) return
    setBusy(true)
    setFailure(null)
    const input: ClearScopeInput = {
      workspaceTitle: request.mode === 'workspace' ? request.workspaceTitle : '',
      titleOccurrence: request.titleOccurrence,
    }
    void onClear(input).then(outcome => {
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
          + 'The rest could not be resolved to safe on-disk directories.')
        onCleared()
        return
      }
      onCleared()
      close()
    })
  }

  return (
    <RiskConfirmation
      open
      title={request.mode === 'workspace' ? 'Clear session history' : 'Clear all session history'}
      description={failure !== null ? `Delete failed: ${failure}` : result !== null ? result : description}
      acknowledgeLabel={nothingToDelete || previewPending || previewFailed
        ? 'I understand this action deletes session logs from disk.'
        : counts.targets === 1
          ? 'I understand this 1 session log will be permanently deleted from disk.'
          : `I understand these ${counts.targets} session logs will be permanently deleted from disk.`}
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

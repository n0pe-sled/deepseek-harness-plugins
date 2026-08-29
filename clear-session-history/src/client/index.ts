/**
 * Browser half of the Clear Session History plugin.
 *
 * Registers no slots: the three affordances live on existing sidebar surfaces
 * (see ./augment.ts). This entry mounts the plugin's Remote namespace, hosts
 * the confirm dialog on its own React root, and wires the sides together —
 * augmentation clicks open the dialog, the dialog calls the host through the
 * Remote, and a successful clear reloads the page so the fresh session and
 * workspace lists reflect the deletion.
 *
 * A workspace-menu clear targets a workspace by display title
 * (+ occurrence among same-titled rows); the clear-all button targets all
 * workspaces; a session-menu delete targets one session by id, which this
 * module resolves from the DOM row (workspace group + row index) against the
 * client session/workspace stores, since session ids never reach the DOM.
 *
 * Export discipline (packages/client/AGENTS.md): the ./client entry exports
 * only `apply`/`inject` and shared types.
 */

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { ClearHistoryDialog } from './dialog.tsx'
import type { ClearDialogRequest, DialogApi } from './dialog.tsx'
import { installSidebarIntegration } from './augment.ts'
import type { SessionTarget } from './augment.ts'
import { DESCRIPTORS, SERVICE } from '../shared/remote.ts'
import type {
  ClearOutcome, ClearScopeInput, PreviewOutcome, RemoteCallOutcome, SessionScopeInput,
} from '../shared/remote.ts'

/** The mounted clearSessionHistory namespace, resolved through the service store. */
interface ClearSessionHistoryNamespace {
  preview(input: ClearScopeInput): Promise<RemoteResult<PreviewOutcome>>
  clear(input: ClearScopeInput): Promise<RemoteResult<ClearOutcome>>
  previewSession(input: SessionScopeInput): Promise<RemoteResult<PreviewOutcome>>
  clearSession(input: SessionScopeInput): Promise<RemoteResult<ClearOutcome>>
}

/** One clear call's target: a session id (single delete) or a workspace scope. */
type ClearCallInput = ClearScopeInput | SessionScopeInput

/** Required services (cordis fiber inject). */
export const inject = ['remote']

export function apply(ctx: ClientContext): void {
  // Mount the Remote for this plugin's fiber. Not awaited: a mount failure
  // only disables the dialog's calls; the augmentation still renders but the
  // preview outcome surfaces the transport error.
  const mount = ctx.remote.$mount({
    package: 'dsh-clear-session-history',
    descriptors: [...DESCRIPTORS],
  })
  mount.catch(() => {})

  /** Call one Remote method, surfacing mount/transport failures as outcomes. */
  const call = async <R>(
    invoke: (namespace: ClearSessionHistoryNamespace) => Promise<RemoteResult<R>>,
  ): Promise<RemoteCallOutcome<R>> => {
    try {
      await mount
      const namespace = ctx.get(`remote.${SERVICE}`) as ClearSessionHistoryNamespace | undefined
      if (namespace === undefined) {
        return { ok: false, error: 'Clear Session History is unavailable — the remote is not mounted.' }
      }
      const result = await invoke(namespace)
      if (result.ok) return { ok: true, value: result.value }
      return { ok: false, error: `${result.error.message} (${result.error.code})` }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Duck-typed faces of the client session/workspace stores (the concrete
  // runtimes expose snapshots; the interfaces keep them hidden).
  interface ClientSessions { list: { getSnapshot(): { byId: Record<string, { title?: string }>; ids: string[] } } }
  interface ClientWorkspaces {
    list: { getSnapshot(): { items: { title: string; sessionIds: string[] }[]; archivedSessionIds: string[] } }
  }

  /**
   * Resolve a session row to its id. The sidebar renders each workspace
   * group's rows in `workspace.sessionIds` order, skipping ids with no
   * summary (deleted) and archived ids — the same filtering this function
   * applies, so the clicked row's DOM index into the group still addresses
   * the account. The session title double-checks the match. Ungrouped rows
   * match by title among sessions no workspace owns, in list order.
   */
  const resolveSessionId = (target: SessionTarget): string | undefined => {
    const sessions = (ctx as unknown as { sessions?: ClientSessions }).sessions
    const workspaces = (ctx as unknown as { workspaces?: ClientWorkspaces }).workspaces
    const state = sessions?.list?.getSnapshot()
    const wsState = workspaces?.list?.getSnapshot()
    if (state === undefined || wsState === undefined) return undefined

    const archived = new Set(wsState.archivedSessionIds)
    const visible = (ids: string[]) => ids
      .filter(id => state.byId[id] !== undefined && !archived.has(id))

    if (target.workspaceTitle === null) {
      const assigned = new Set(wsState.items.flatMap(workspace => workspace.sessionIds))
      const bare = visible(state.ids).filter(id => !assigned.has(id))
      const candidates = bare.filter(id => state.byId[id]?.title === target.sessionTitle)
      return candidates[target.rowIndex]
    }

    const sameTitle = wsState.items.filter(workspace => workspace.title === target.workspaceTitle)
    const workspace = sameTitle[target.workspaceOccurrence] ?? sameTitle[0]
    if (workspace === undefined) return undefined
    const account = visible(workspace.sessionIds)
    const byIndex = account[target.rowIndex]
    if (byIndex !== undefined && state.byId[byIndex]?.title === target.sessionTitle) return byIndex
    const byTitle = account.filter(id => state.byId[id]?.title === target.sessionTitle)
    return byTitle[target.rowIndex]
  }

  // React root for the confirm dialog. The container is never appended: the
  // Modal primitive portals its overlay to document.body itself.
  const container = document.createElement('div')
  const root = createRoot(container)
  const apiRef: { current: DialogApi | null } = { current: null }

  /** Repull the sidebar session list, best-effort, for partial clears. */
  const refreshSidebar = (): void => {
    const sessions = (ctx as unknown as { sessions?: { refresh?: () => Promise<unknown> } }).sessions
    sessions?.refresh?.()?.catch(() => {})
  }

  /** After a fully successful clear, reload the page. The host has no
   * "session deleted" push event to notify the sidebar, and the safest way to
   * guarantee both the session list and the workspace list reflect the
   * deletion is a fresh pull — the same outcome as the manual reload that
   * already verified the delete. */
  const reloadAfterClear = (): void => {
    window.location.reload()
  }

  const openDialog = (request: ClearDialogRequest): void => { apiRef.current?.open(request) }
  const openSessionDialog = (target: SessionTarget): void => {
    const sessionId = resolveSessionId(target)
    openDialog({
      mode: 'session',
      workspaceTitle: target.workspaceTitle ?? '',
      titleOccurrence: target.workspaceOccurrence,
      ...(sessionId === undefined ? {} : { sessionId }),
      sessionTitle: target.sessionTitle,
    })
  }

  installSidebarIntegration({ openDialog, openSessionDialog })

  root.render(createElement(ClearHistoryDialog, {
    register: api => { apiRef.current = api },
    onPreview: (mode: ClearDialogRequest['mode'], input: ClearCallInput) =>
      mode === 'session' ? call(ns => ns.previewSession(input as SessionScopeInput))
        : call(ns => ns.preview(input as ClearScopeInput)),
    onClear: (mode: ClearDialogRequest['mode'], input: ClearCallInput) =>
      mode === 'session' ? call(ns => ns.clearSession(input as SessionScopeInput))
        : call(ns => ns.clear(input as ClearScopeInput)),
    onSuccess: reloadAfterClear,
    onCleared: refreshSidebar,
  }))

  // The plugin fiber dying must not leave the augmentation or the React root
  // behind. ctx.effect registers cleanup with the fiber lifecycle.
  ctx.effect(
    () => () => {
      root.unmount()
      container.remove()
    },
    'clear-session-history: unmount dialog root',
  )
}

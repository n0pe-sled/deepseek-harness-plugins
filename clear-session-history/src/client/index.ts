/**
 * Browser half of the Clear Session History plugin.
 *
 * Registers no slots: the two affordances live on existing sidebar surfaces
 * (see ./augment.ts). This entry mounts the plugin's Remote namespace, hosts
 * the confirm dialog on its own React root, and wires the three sides
 * together — augmentation clicks open the dialog, the dialog calls the host
 * through the Remote, and a successful clear repulls the sidebar's session
 * list so the deleted rows disappear immediately.
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
import { DESCRIPTORS, SERVICE } from '../shared/remote.ts'
import type { ClearOutcome, ClearScopeInput, PreviewOutcome, RemoteCallOutcome } from '../shared/remote.ts'

/** The mounted clearSessionHistory namespace, resolved through the service store. */
interface ClearSessionHistoryNamespace {
  preview(input: ClearScopeInput): Promise<RemoteResult<PreviewOutcome>>
  clear(input: ClearScopeInput): Promise<RemoteResult<ClearOutcome>>
}

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
    method: (namespace: ClearSessionHistoryNamespace) => (input: ClearScopeInput) => Promise<RemoteResult<R>>,
    input: ClearScopeInput,
  ): Promise<RemoteCallOutcome<R>> => {
    try {
      await mount
      const namespace = ctx.get(`remote.${SERVICE}`) as ClearSessionHistoryNamespace | undefined
      if (namespace === undefined) {
        return { ok: false, error: 'Clear Session History is unavailable — the remote is not mounted.' }
      }
      const result = await method(namespace)(input)
      if (result.ok) return { ok: true, value: result.value }
      return { ok: false, error: `${result.error.message} (${result.error.code})` }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // React root for the confirm dialog. The container is never appended: the
  // Modal primitive portals its overlay to document.body itself.
  const container = document.createElement('div')
  const root = createRoot(container)
  const apiRef: { current: DialogApi | null } = { current: null }

  /** Repull the sidebar session list after a clear. The runtime exposes the
   * refresh on the concrete face but not on the ISessions interface, so the
   * call is duck-typed and simply skipped when absent. */
  const refreshSidebar = (): void => {
    const sessions = (ctx as unknown as { sessions?: { refresh?: () => Promise<unknown> } }).sessions
    sessions?.refresh?.()?.catch(() => {})
  }

  installSidebarIntegration({
    openDialog: (request: ClearDialogRequest) => { apiRef.current?.open(request) },
  })

  root.render(createElement(ClearHistoryDialog, {
    register: api => { apiRef.current = api },
    onPreview: input => call(ns => ns.preview, input),
    onClear: input => call(ns => ns.clear, input),
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

/**
 * Browser-side DOM integration for the Clear Session History plugin.
 *
 * The two target surfaces — the workspace row menu (Rename / Delete workspace)
 * and the New Session button — belong to ui-workspace / ui-sidebar and declare
 * no plugin slots, so this module augments them at the DOM level:
 *
 * - A body-level MutationObserver sees the ui-primitives `Menu` portal lists
 *   (a `div[role="menu"]` appended to document.body). A list whose items
 *   include the workspace Rename + Delete pair is the workspace menu; its
 *   Delete row is cloned into a "Clear session history" row (same classes, so
 *   the styling — including the danger color — matches exactly). Which
 *   workspace is recorded from the anchor button's aria-label at pointerdown,
 *   together with an occurrence index among same-titled workspace rows, so
 *   same-basename workspaces resolve deterministically.
 * - The New Session button (exact localized aria-label) gets a red
 *   "clear all" sibling inserted directly below it in the wide sidebar; the
 *   rail stays untouched. The clone carries the New Session button's own
 *   classes, so geometry follows the shell's stylesheet.
 *
 * Every hook degrades to a no-op when a template fails to match (unknown
 * locale, restructured DOM): the plugin then simply does not render its
 * affordances instead of breaking the sidebar.
 */

/** A dialog request the augmentation hands back to the plugin. */
export interface ClearDialogRequest {
  mode: 'workspace' | 'all' | 'session'
  workspaceTitle: string
  titleOccurrence: number
  /** session mode only: the resolved session id (node half deletes by it). */
  sessionId?: string
  /** session mode only: the session's display title, shown in the dialog. */
  sessionTitle?: string
}

/** The DOM facts captured from a session row's menu anchor at arming time,
 * before the portal menu opens. The plugin resolves these to a session id
 * through the client stores. */
export interface SessionTarget {
  sessionTitle: string
  /** The enclosing workspace group's title, or null for an ungrouped row. */
  workspaceTitle: string | null
  /** Index of the group among registry workspaces sharing its title. */
  workspaceOccurrence: number
  /** Index of the row within its group (== index in `workspace.sessionIds`). */
  rowIndex: number
}

export interface SidebarIntegrationOptions {
  openDialog(request: ClearDialogRequest): void
  /** Resolve a session target to an id and open the delete-session dialog. */
  openSessionDialog(target: SessionTarget): void
}

/** Anchor arming window: the portal menu must appear within this long after
 * the pointerdown on a workspace/session row's menu anchor. */
const MENU_ARM_MS = 5000

const WORKSPACE_ARIA_EN_PREFIX = 'Workspace actions for '
const WORKSPACE_ARIA_ZH = /^工作区“(.*)”的操作$/
const SESSION_ARIA_EN_PREFIX = 'Session actions for '
const SESSION_ARIA_ZH = /^会话“(.*)”的操作$/

const RENAME_LABELS = new Set(['Rename', '重命名'])
const DELETE_LABELS = new Set(['Delete workspace', '删除工作区'])
/** A session row's menu is the one carrying a Fork/Archive row (the workspace
 * menu's fork/archive are absent; its Delete-workspace pair is). */
const SESSION_MENU_MARKERS = new Set(['Fork session', '分叉会话', 'Archive session', '归档会话'])
const NEW_SESSION_ARIA = new Set(['New session', '新建会话'])
const NEW_SESSION_TEXT = new Set(['New Session', '新会话'])

const MENU_ITEM_LABEL: Record<'en' | 'zh', string> = {
  en: 'Clear session history',
  zh: '清空会话记录',
}
const SESSION_DELETE_LABEL: Record<'en' | 'zh', string> = {
  en: 'Delete session',
  zh: '删除会话',
}
const SIDEBAR_LABEL: Record<'en' | 'zh', string> = {
  en: 'Clear all session history',
  zh: '清空全部会话记录',
}
const SIDEBAR_ARIA: Record<'en' | 'zh', string> = {
  en: 'Clear all session history',
  zh: '清空全部会话记录',
}

/** Extract the workspace display title from a workspace row menu anchor. */
function workspaceTitleOf(label: string): string | undefined {
  if (label.startsWith(WORKSPACE_ARIA_EN_PREFIX)) {
    const title = label.slice(WORKSPACE_ARIA_EN_PREFIX.length)
    return title === '' ? undefined : title
  }
  const zh = WORKSPACE_ARIA_ZH.exec(label)
  const title = zh?.[1]
  return title === undefined || title === '' ? undefined : title
}

/** Extract the session display title from a session row menu anchor. */
function sessionTitleOf(label: string): string | undefined {
  if (label.startsWith(SESSION_ARIA_EN_PREFIX)) {
    const title = label.slice(SESSION_ARIA_EN_PREFIX.length)
    return title === '' ? undefined : title
  }
  const zh = SESSION_ARIA_ZH.exec(label)
  const title = zh?.[1]
  return title === undefined || title === '' ? undefined : title
}

const itemText = (button: HTMLButtonElement): string => (button.textContent ?? '').trim()

/** A minimal 16px trash glyph that inherits currentColor from the danger rules. */
const TRASH_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>'

export function installSidebarIntegration(options: SidebarIntegrationOptions): () => void {
  type Armed =
    | { kind: 'workspace'; title: string; titleOccurrence: number; at: number }
    | { kind: 'session'; target: SessionTarget; at: number }
  /** The row whose menu anchor was engaged most recently. */
  let armed: Armed | null = null

  // ---- Anchor arming ------------------------------------------------------

  const armFromEvent = (target: Element): void => {
    const button = target.closest<HTMLButtonElement>('button[aria-label]')
    if (button === null) return
    const label = button.getAttribute('aria-label') ?? ''
    const workspaceTitle = workspaceTitleOf(label)
    if (workspaceTitle !== undefined) {
      // Occurrence index among same-titled anchors in DOM order — the sidebar
      // renders workspace rows in registry display order.
      const same = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')]
        .filter(candidate => workspaceTitleOf(candidate.getAttribute('aria-label') ?? '') === workspaceTitle)
      const occurrence = Math.max(0, same.indexOf(button))
      armed = { kind: 'workspace', title: workspaceTitle, titleOccurrence: occurrence, at: Date.now() }
      return
    }

    const sessionTitle = sessionTitleOf(label)
    if (sessionTitle === undefined) return
    const row = button.closest<HTMLElement>('[role="treeitem"][aria-selected]')
    if (row === null) return
    // The enclosing workspace group is the closest ancestor that contains a
    // workspace-menu anchor (the group's header row). None → ungrouped.
    let group: HTMLElement | null = null
    for (let parent: Element | null = row.parentElement; parent !== null && parent !== document.body; parent = parent.parentElement) {
      const anchor = parent.querySelector<HTMLButtonElement>('button[aria-label]')
      if (anchor !== null && workspaceTitleOf(anchor.getAttribute('aria-label') ?? '') !== undefined) {
        group = parent as HTMLElement
        break
      }
    }
    const sessions = group === null
      ? [row]
      : [...group.querySelectorAll<HTMLElement>('[role="treeitem"][aria-selected]')]
    const rowIndex = Math.max(0, sessions.indexOf(row))
    let workspaceOccurrence = 0
    let groupWorkspaceTitle: string | null = null
    if (group !== null) {
      const anchor = group.querySelector<HTMLButtonElement>('button[aria-label]')
      const title = anchor === null ? undefined : workspaceTitleOf(anchor.getAttribute('aria-label') ?? '')
      groupWorkspaceTitle = title ?? null
      if (anchor !== null && title !== undefined) {
        const same = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')]
          .filter(candidate => workspaceTitleOf(candidate.getAttribute('aria-label') ?? '') === title)
        workspaceOccurrence = Math.max(0, same.indexOf(anchor))
      }
    }
    armed = {
      kind: 'session',
      target: {
        sessionTitle,
        workspaceTitle: groupWorkspaceTitle,
        workspaceOccurrence,
        rowIndex,
      },
      at: Date.now(),
    }
  }

  // Capture-phase pointerdown arms the row identity before the menu opens; the
  // keydown arm covers keyboard activation (Enter/Space fire no pointer events).
  const onPointerDown = (event: PointerEvent): void => {
    if (event.target instanceof Element) armFromEvent(event.target)
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.target instanceof Element) armFromEvent(event.target)
  }
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown, true)

  // ---- Menu augmentation --------------------------------------------------

  /** Close whatever Menu list the clone lives in (outside pointerdown → onClose). */
  const dismissMenu = (): void => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  }

  /** Add a "Delete session" row to a session row's menu. */
  const augmentSessionMenu = (menu: HTMLElement, target: SessionTarget): void => {
    if (menu.querySelector('[data-dsh-clear-session]') !== null) return
    const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')]
    const marker = buttons.find(button => SESSION_MENU_MARKERS.has(itemText(button)))
    const source = buttons[buttons.length - 1]
    if (marker === undefined || source === undefined) return
    const wrapper = source.parentElement
    if (!(wrapper instanceof HTMLElement) || wrapper.parentElement === null) return

    const locale: 'en' | 'zh' = itemText(marker) === 'Fork session' || itemText(marker) === 'Archive session' ? 'en' : 'zh'
    const label = SESSION_DELETE_LABEL[locale]

    const clone = wrapper.cloneNode(true)
    if (!(clone instanceof HTMLElement)) return
    const cloneButton = clone.querySelector<HTMLButtonElement>('button[role="menuitem"]')
    if (cloneButton === null) return
    cloneButton.dataset.dshClearSession = 'true'
    cloneButton.setAttribute('aria-label', label)
    // Label: replace the source row's text with the delete label (the source
    // is the last session verb, e.g. Archive).
    const sourceText = itemText(source)
    for (const span of cloneButton.querySelectorAll('span')) {
      if ((span.textContent ?? '').trim() === sourceText) {
        span.textContent = label
        break
      }
    }
    // Icon: swap the leading icon slot for a trash glyph (colored by the
    // danger rules via currentColor).
    const currentIcon = cloneButton.querySelector('svg')
    if (currentIcon !== null) {
      const holder = document.createElement('div')
      holder.innerHTML = TRASH_ICON_SVG
      const trash = holder.firstElementChild
      if (trash !== null) currentIcon.replaceWith(trash)
    }
    cloneButton.addEventListener('click', (event) => {
      event.stopPropagation()
      dismissMenu()
      options.openSessionDialog(target)
    })
    wrapper.after(clone)
  }

  const augmentMenu = (menu: HTMLElement): void => {
    const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')]
    const deleteRow = buttons.find(button => DELETE_LABELS.has(itemText(button)))
    const isWorkspaceMenu = deleteRow !== undefined && buttons.some(button => RENAME_LABELS.has(itemText(button)))
    const isSessionMenu = !isWorkspaceMenu && buttons.some(button => SESSION_MENU_MARKERS.has(itemText(button)))
    if (isWorkspaceMenu) return augmentWorkspaceMenu(menu, deleteRow)
    if (!isSessionMenu) return
    if (armed === null || armed.kind !== 'session' || Date.now() - armed.at > MENU_ARM_MS) return
    const { target } = armed
    armed = null
    augmentSessionMenu(menu, target)
  }

  /** Add a "Clear session history" row to a workspace row's menu. */
  const augmentWorkspaceMenu = (
    menu: HTMLElement,
    deleteRow: HTMLButtonElement | undefined,
  ): void => {
    if (menu.querySelector('[data-dsh-clear-history]') !== null) return
    if (deleteRow === undefined) return
    if (armed === null || armed.kind !== 'workspace' || Date.now() - armed.at > MENU_ARM_MS) return
    const { title, titleOccurrence } = armed
    armed = null

    const wrapper = deleteRow.parentElement
    if (!(wrapper instanceof HTMLElement) || wrapper.parentElement === null) return
    const deletedLabel = itemText(deleteRow)
    const locale: 'en' | 'zh' = deletedLabel === 'Delete workspace' ? 'en' : 'zh'

    const clone = wrapper.cloneNode(true)
    if (!(clone instanceof HTMLElement)) return
    const cloneButton = clone.querySelector<HTMLButtonElement>('button[role="menuitem"]')
    if (cloneButton === null) return
    cloneButton.dataset.dshClearHistory = 'true'
    cloneButton.setAttribute('aria-label', MENU_ITEM_LABEL[locale])
    for (const span of cloneButton.querySelectorAll('span')) {
      if ((span.textContent ?? '').trim() === deletedLabel) {
        span.textContent = MENU_ITEM_LABEL[locale]
        break
      }
    }
    cloneButton.addEventListener('click', (event) => {
      event.stopPropagation()
      dismissMenu()
      options.openDialog({ mode: 'workspace', workspaceTitle: title, titleOccurrence })
    })
    wrapper.after(clone)
  }

  const menuObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement && node.getAttribute('role') === 'menu') {
          // One microtask later: the portal list is complete once React commits.
          queueMicrotask(() => {
            if (node.isConnected) augmentMenu(node)
          })
        }
      }
    }
  })
  menuObserver.observe(document.body, { childList: true })

  // ---- Red clear-all button under New Session -----------------------------

  // The clone reuses the New Session button's own (hashed) classes, so geometry
  // and typography follow the shell's stylesheet; a scoped rule pins red.
  const style = document.createElement('style')
  style.dataset.dshClearAllStyle = 'true'
  style.textContent = [
    '[data-dsh-clear-all], [data-dsh-clear-all] span { color: var(--dsw-alias-state-error-primary) !important; }',
    '[data-dsh-clear-all]:hover, [data-dsh-clear-all]:hover span { color: var(--dsw-alias-state-error-secondary) !important; }',
    '[data-dsh-clear-session], [data-dsh-clear-session] span, [data-dsh-clear-session] svg { color: var(--dsw-alias-state-error-primary) !important; }',
    '[data-dsh-clear-session]:hover, [data-dsh-clear-session]:hover span, [data-dsh-clear-session]:hover svg { color: var(--dsw-alias-state-error-secondary) !important; background: var(--dsw-alias-interactive-bg-hover-danger); }',
  ].join('\n')
  document.head.appendChild(style)

  const syncButton = (): void => {
    // Both the brand/logo row and the dedicated button share the
    // `New session` aria-label, but only the dedicated button carries the
    // "New Session" label text in the wide sidebar (the brand row shows the
    // product name). Key on that label span so the clear-all button lands
    // directly below the real New Session button, and so the icon-only rail
    // (no label text) keeps it hidden.
    const anchors = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')]
      .filter(button => NEW_SESSION_ARIA.has(button.getAttribute('aria-label') ?? ''))
      .filter(button => [...button.querySelectorAll('span')]
        .some(span => NEW_SESSION_TEXT.has((span.textContent ?? '').trim())))
    const anchor = anchors[0] ?? null

    const existing = document.querySelector<HTMLButtonElement>('[data-dsh-clear-all]')
    if (anchor === null) {
      existing?.remove()
      return
    }
    // The insert below is idempotent, but sweep any strays first so a
    // re-entrant path can never restack duplicates.
    for (const extra of document.querySelectorAll<HTMLButtonElement>('[data-dsh-clear-all]')) {
      if (extra !== existing) extra.remove()
    }
    if (existing !== null && anchor.nextElementSibling === existing) return

    const locale: 'en' | 'zh' = [...anchor.querySelectorAll('span')]
      .some(span => (span.textContent ?? '').trim() === '新会话') ? 'zh' : 'en'

    const button = (existing ?? ((anchor.cloneNode(true)) as HTMLButtonElement))
    button.dataset.dshClearAll = 'true'
    button.removeAttribute('title')
    button.setAttribute('aria-label', SIDEBAR_ARIA[locale])
    let labelled = false
    for (const span of button.querySelectorAll('span')) {
      const text = (span.textContent ?? '').trim()
      if (NEW_SESSION_TEXT.has(text)) {
        span.textContent = SIDEBAR_LABEL[locale]
        labelled = true
        break
      }
    }
    if (!labelled) return // structure changed; do not render a mislabeled control
    button.onclick = (event) => {
      event.stopPropagation()
      options.openDialog({ mode: 'all', workspaceTitle: '', titleOccurrence: 0 })
    }
    if (button.parentElement === null || button.parentElement !== anchor.parentElement) {
      anchor.after(button)
    } else if (anchor.nextElementSibling !== button) {
      anchor.after(button)
    }
  }

  let syncScheduled = false
  const scheduleSync = (): void => {
    if (syncScheduled) return
    syncScheduled = true
    requestAnimationFrame(() => {
      syncScheduled = false
      syncButton()
    })
  }

  const sidebarObserver = new MutationObserver(scheduleSync)
  sidebarObserver.observe(document.body, { childList: true, subtree: true })
  // Fallback tick: catches attribute-only re-renders and missed mutations.
  const interval = window.setInterval(syncButton, 2000)
  syncButton()

  return () => {
    menuObserver.disconnect()
    sidebarObserver.disconnect()
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeyDown, true)
    window.clearInterval(interval)
    document.querySelector<HTMLButtonElement>('[data-dsh-clear-all]')?.remove()
    style.remove()
  }
}

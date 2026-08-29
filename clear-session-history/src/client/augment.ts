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
  mode: 'workspace' | 'all'
  workspaceTitle: string
  titleOccurrence: number
}

export interface SidebarIntegrationOptions {
  openDialog(request: ClearDialogRequest): void
}

/** Anchor arming window: the portal menu must appear within this long after
 * the pointerdown on a workspace row's menu anchor. */
const MENU_ARM_MS = 5000

const WORKSPACE_ARIA_EN_PREFIX = 'Workspace actions for '
const WORKSPACE_ARIA_ZH = /^工作区“(.*)”的操作$/

const RENAME_LABELS = new Set(['Rename', '重命名'])
const DELETE_LABELS = new Set(['Delete workspace', '删除工作区'])
const NEW_SESSION_ARIA = new Set(['New session', '新建会话'])
const NEW_SESSION_TEXT = new Set(['New Session', '新会话'])

const MENU_ITEM_LABEL: Record<'en' | 'zh', string> = {
  en: 'Clear session history',
  zh: '清空会话记录',
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

const itemText = (button: HTMLButtonElement): string => (button.textContent ?? '').trim()

export function installSidebarIntegration(options: SidebarIntegrationOptions): () => void {
  /** The workspace row whose menu anchor was clicked most recently. */
  let armed: { title: string; titleOccurrence: number; at: number } | null = null

  // ---- Anchor arming ------------------------------------------------------

  const armFromEvent = (target: Element): void => {
    const button = target.closest<HTMLButtonElement>('button[aria-label]')
    if (button === null) return
    const label = button.getAttribute('aria-label') ?? ''
    const title = workspaceTitleOf(label)
    if (title === undefined) return
    // Occurrence index among same-titled anchors in DOM order — the sidebar
    // renders workspace rows in registry display order.
    const same = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')]
      .filter(candidate => workspaceTitleOf(candidate.getAttribute('aria-label') ?? '') === title)
    const occurrence = Math.max(0, same.indexOf(button))
    armed = { title, titleOccurrence: occurrence, at: Date.now() }
  }

  // Capture-phase pointerdown arms the workspace identity before the menu
  // opens; the keydown arm covers keyboard activation (Enter/Space fire no
  // pointer events).
  const onPointerDown = (event: PointerEvent): void => {
    if (event.target instanceof Element) armFromEvent(event.target)
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.target instanceof Element) armFromEvent(event.target)
  }
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown, true)

  // ---- Workspace menu augmentation ---------------------------------------

  /** Close whatever Menu list the clone lives in (outside pointerdown → onClose). */
  const dismissMenu = (): void => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  }

  const augmentMenu = (menu: HTMLElement): void => {
    if (menu.querySelector('[data-dsh-clear-history]') !== null) return
    const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')]
    const deleteRow = buttons.find(button => DELETE_LABELS.has(itemText(button)))
    if (deleteRow === undefined) return
    if (!buttons.some(button => RENAME_LABELS.has(itemText(button)))) return
    if (armed === null || Date.now() - armed.at > MENU_ARM_MS) return
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
    // Retarget the visible label span (the one that carried the Delete text);
    // the leading icon span (trash) is kept as-is.
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

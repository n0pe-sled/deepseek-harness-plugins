/**
 * Browser half of the Herdr Themes plugin.
 *
 * Registers every herdr built-in theme into DSH's ThemeRuntime (`ctx.theme`),
 * persists the selected theme id through this plugin's own settings namespace
 * (host-side, `$DSH_HOME/settings.yaml` under the shipped provider — third-party
 * theme ids deliberately never cross the built-in ui-theme preference schema),
 * and registers the Settings → Themes page where each theme can be previewed
 * live and then saved.
 *
 * Interaction model: a card click applies the theme immediately (live preview,
 * DOM updates through ui-layout's presenter); the card then offers “Use” to
 * persist it and “Cancel” to fall back to the saved selection.
 *
 * Reassertion contract: ThemeRuntime re-adopts the durable built-in preference
 * (light/dark/system) whenever the settings document re-derives — any write or
 * push, not just ours — and that reset displaces an in-process third-party
 * theme id. A saved herdr theme is the user's explicit choice, so it is
 * re-applied after every such reset. Only this plugin's own apply/preview
 * calls suppress the reassertion, so previewing (or saving) the system option
 * is not fought; the built-in Appearance row therefore stops overriding a
 * saved theme (see README, “Notes and limits”).
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the ctx.settingsScope merge and the settings.section slot declaration.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the ctx.theme merge from dsh-client-ui-theme (cross-plugin
// collaboration goes through the service, never a value import).
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import { BUILTIN_PREFERENCE_IDS, HERDR_THEMES } from '../shared/themes.ts'
import { ThemesPanel } from './ThemesPanel.tsx'
import type { ThemeApplyOutcome, ThemeSelection, ThemesPanelInjected } from './ThemesPanel.tsx'

export type { ThemeApplyOutcome, ThemeSelection, ThemesPanelInjected, ThemesPanelProps } from './ThemesPanel.tsx'

/** Plugin-owned namespace on the Host settings document. */
export const SETTINGS_NAMESPACE = 'herdr-themes'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'settingsScope', 'theme']

/**
 * Register the themes and the Settings page.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // Bind once in apply: the disposer belongs to this fiber and the observable
  // identity must stay stable across inject-factory calls.
  const scope = ctx.settingsScope.bind<ThemeSelection>({ namespace: SETTINGS_NAMESPACE })

  // One registration per theme; the disposer unregisters on plugin unload.
  for (const theme of HERDR_THEMES) {
    ctx.effect(() => ctx.theme.register(theme), `herdr-themes: register ${theme.id}`)
  }

  const storedId = (): string => {
    const value = scope.getSnapshot().value
    return typeof value?.themeId === 'string' ? value.themeId : ''
  }

  // Re-apply the persisted selection as soon as the scope derives it at boot.
  // A stale id (theme removed in a newer plugin version) clears itself.
  const adopt = (): void => {
    const id = storedId()
    if (id === '' || id === ctx.theme.getTheme().preference) return
    try {
      ctx.theme.setTheme(id)
    } catch {
      void scope.set('themeId', '').catch(() => {})
    }
  }
  ctx.effect(() => scope.subscribe(adopt), 'herdr-themes: adopt stored theme')

  // Reassertion against ThemeRuntime's built-in adoption (see header). The
  // reassertion itself publishes a theme/change with the saved id, which is
  // not a built-in preference, so the handler cannot recurse.
  const reassert = (): void => {
    const id = storedId()
    if (id === '') return
    try {
      ctx.theme.setTheme(id)
    } catch {
      void scope.set('themeId', '').catch(() => {})
    }
  }

  // Suppression window: our own apply/preview/cancel calls must not be fought
  // by the reassertion. setTheme publishes synchronously and the handler runs
  // inside that publish, so a simple boolean around the call suffices.
  let suppressing = false
  const setThemeQuietly = (id: string): void => {
    suppressing = true
    try {
      ctx.theme.setTheme(id)
    } catch {
      // Unknown id (never registered): keep the current theme.
    } finally {
      suppressing = false
    }
  }

  ctx.on('theme/change', (snapshot: ThemeSnapshot) => {
    if (suppressing) return
    if (!(BUILTIN_PREFERENCE_IDS as readonly string[]).includes(snapshot.preference)) return
    reassert()
  })

  const preview = (id: string): void => setThemeQuietly(id)

  const cancel = (): void => {
    const id = storedId()
    setThemeQuietly(id === '' ? 'system' : id)
  }

  /** Persist the selection; the Host read-back is the only truth. */
  const apply = async (id: string): Promise<ThemeApplyOutcome> => {
    if (id === 'system') {
      // Clear first: a saved theme must be gone before the built-in preference
      // lands, or the reassertion would bring it right back.
      if (scope.getSnapshot().mode === 'memory') {
        setThemeQuietly('system')
        return { status: 'session-only' }
      }
      try {
        await scope.set('themeId', '')
      } catch (error) {
        return { status: 'error', message: error instanceof Error ? error.message : String(error) }
      }
      setThemeQuietly('system')
      return scope.getSnapshot().value?.themeId === '' || scope.getSnapshot().value?.themeId === undefined
        ? { status: 'saved' }
        : { status: 'not-applied' }
    }
    setThemeQuietly(id)
    if (scope.getSnapshot().mode === 'memory') return { status: 'session-only' }
    try {
      await scope.set('themeId', id)
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
    // The write's settings event re-triggers the built-in adoption; the
    // reassertion restores this theme if it does.
    return scope.getSnapshot().value?.themeId === id ? { status: 'saved' } : { status: 'not-applied' }
  }

  // ThemeRuntime read face as a slot hooks source: snapshot + subscribe.
  const themeView: HostObservable<ThemeSnapshot> = {
    getSnapshot: () => ctx.theme.getTheme(),
    subscribe: (listener: () => void) => ctx.on('theme/change', () => { listener() }),
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'herdr-themes',
    order: 5,
    label: 'Themes',
    inject: (): ThemesPanelInjected => ({
      hooks: { selection: scope, theme: themeView },
      actions: { preview, apply, cancel },
    }),
  }, ThemesPanel))
}

/**
 * Host (Node) half of the Herdr Themes plugin.
 *
 * The themes themselves live in the browser: DSH's ThemeRuntime (from
 * `dsh-client-ui-theme`) is the registry and DOM presentation is the
 * presenter's job, and third-party theme ids are an in-process extension that
 * never cross the built-in settings schema. What the host half owns is the
 * plugin's own durable namespace (`herdr-themes` -> `themeId`), so the
 * selection survives a GUI reload: the browser half writes it here and
 * re-applies it on boot through `ctx.theme.setTheme(id)`.
 *
 * Registering the namespace here is what lets the browser's settings scope
 * validate and persist it — the host serves the schema envelope that the
 * browser-side scope decodes against (ui-settings' SettingsScopeController).
 */

import Schema from '@deepseek-ai/schemastery'
import type z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-settings'

/** The full theme catalog (palette + derived tokens), shared with tests. */
export { HERDR_THEMES } from './shared/themes.ts'
export type { HerdrPalette, HerdrThemeDef } from './shared/themes.ts'

export const name = 'herdr-themes'

/** Services that must be mounted before this plugin runs. */
export const inject = ['settings']

/** Plugin-owned settings namespace. */
const NAMESPACE = 'herdr-themes' as SettingsNamespace

/** The stored selection: theme id or '' for the built-in preference. */
export interface SettingsSection {
  themeId: string
}

/**
 * Register the durable namespace; the browser half owns everything else.
 * @param ctx - host cordis context.
 */
export function apply(ctx: Context): void {
  const sectionSchema: z<SettingsSection> = Schema.object({
    themeId: Schema.string().default(''),
  })
  ctx.settings.register(NAMESPACE, sectionSchema)
}

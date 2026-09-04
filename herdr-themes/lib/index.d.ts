import { Context } from "@deepseek-ai/cordis";
//#region src/shared/themes.d.ts
/**
 * The 18 built-in themes shipped by herdr (herdrdev/herdr, src/app/state.rs),
 * translated into DSH `--dsw-*` alias-token overrides.
 *
 * Each herdr theme defines a Palette of UI colors. DSH themes are token
 * dictionaries over the `--dsw-alias-*` semantic layer, so every palette field
 * is mapped onto the closest DSH role: some fields land directly (accent ->
 * brand-primary, text -> label-primary) and the rest are derived with
 * `color-mix` so they adapt to both dark and light base palettes without a
 * second copy. The `terminal` theme's palette is an ANSI approximation: herdr
 * uses terminal named colors there, but DSH has no host-terminal palette, so
 * a fixed near-black xterm-style set is substituted (documented in the
 * README).
 */
/** One herdr palette, all values as hex. */
interface HerdrPalette {
  accent: string;
  panelBg: string;
  activeRowBg: string;
  selectionBg: string;
  surface0: string;
  surface1: string;
  surfaceDim: string;
  overlay0: string;
  overlay1: string;
  text: string;
  subtext0: string;
  mauve: string;
  green: string;
  yellow: string;
  red: string;
  blue: string;
  teal: string;
  peach: string;
}
/** One registrable DSH theme definition. */
interface HerdrThemeDef {
  /** Theme id handed to `setTheme` (herdr canonical name). */
  id: string;
  /** Human-readable name shown in the picker. */
  name: string;
  /** One-line description. */
  description: string;
  /** Which base palette this theme builds on. */
  colorScheme: 'dark' | 'light';
  /** Raw herdr palette (card previews render directly from it). */
  palette: HerdrPalette;
  /** DSH alias-token overrides derived from the palette. */
  tokens: Record<string, string>;
}
/** All registrable themes, in herdr’s THEME_NAMES order. */
declare const HERDR_THEMES: readonly HerdrThemeDef[];
//#endregion
//#region src/index.d.ts
declare const name = "herdr-themes";
/** Services that must be mounted before this plugin runs. */
declare const inject: string[];
/** The stored selection: theme id or '' for the built-in preference. */
interface SettingsSection {
  themeId: string;
}
/**
 * Register the durable namespace; the browser half owns everything else.
 * @param ctx - host cordis context.
 */
declare function apply(ctx: Context): void;
//#endregion
export { HERDR_THEMES, type HerdrPalette, type HerdrThemeDef, SettingsSection, apply, inject, name };
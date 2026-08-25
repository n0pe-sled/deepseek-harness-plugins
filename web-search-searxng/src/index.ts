/**
 * `dsh-web-search-searxng`: registers a SEARXNG-backed `WebSearchProvider`
 * with `ctx.web`, alongside the shipped DeepSeek/Exa/Perplexity providers. A
 * function/namespace plugin, not a default-export service: a search provider
 * registers INTO the seam's registry (`ctx.web.registerSearchProvider`) and
 * never owns the `web` key. The model-facing `web_search` tool stays owned by
 * `@deepseek-ai/dsh-tool-web`; selection is the seam's job, chosen by the
 * `web` row's `searchProvider` config (or `$DSH_WEB_SEARCH_PROVIDER`, or
 * auto-select when exactly one usable provider is registered).
 * @module dsh-web-search-searxng
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: pulls the ctx.web Context merge.
import type {} from '@deepseek-ai/dsh-web'
import {
  SearxngSearchProvider,
  SEARXNG_DEFAULT_BASE_URL,
  SEARXNG_DEFAULT_TIMEOUT_MS,
} from './provider.ts'

export {
  SearxngSearchProvider,
  SEARXNG_DEFAULT_BASE_URL,
  SEARXNG_DEFAULT_TIMEOUT_MS,
  SEARXNG_PROVIDER_ID,
  mapSearxngResponse,
  mapSearxngResult,
} from './provider.ts'
export type { SearxngProviderOptions, SearxngResponse } from './provider.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-searxng'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Plugin config (all optional — `apply` fills defaults). */
export interface Config {
  /** Instance base URL (`/search` is appended). Defaults to the personal instance. */
  baseURL?: string
  /** Comma-separated SEARXNG engine filter (`engines=`). */
  engines?: string
  /** SEARXNG category filter (`categories=`). */
  categories?: string
  /** SEARXNG language hint (`language=`). */
  language?: string
  /** Whole-request timeout in ms. Defaults to 15000. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  baseURL: z.string(),
  engines: z.string(),
  categories: z.string(),
  language: z.string(),
  timeoutMs: z.number().step(1).min(1),
})

/** Register the SEARXNG search provider with `ctx.web`. */
export function apply(ctx: Context, config: Config): void {
  ctx.web.registerSearchProvider(new SearxngSearchProvider({
    baseURL: config.baseURL !== undefined && config.baseURL.trim() !== ''
      ? config.baseURL.trim()
      : SEARXNG_DEFAULT_BASE_URL,
    timeoutMs: config.timeoutMs ?? SEARXNG_DEFAULT_TIMEOUT_MS,
    ...(config.engines !== undefined && config.engines.trim() !== '' ? { engines: config.engines.trim() } : {}),
    ...(config.categories !== undefined && config.categories.trim() !== '' ? { categories: config.categories.trim() } : {}),
    ...(config.language !== undefined && config.language.trim() !== '' ? { language: config.language.trim() } : {}),
  }))
}

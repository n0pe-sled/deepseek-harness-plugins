import z from "@deepseek-ai/schemastery";
import { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from "@deepseek-ai/dsh-web";
import { Context } from "@deepseek-ai/cordis";
//#region src/provider.d.ts
/** Stable id this provider registers under. */
declare const SEARXNG_PROVIDER_ID = "searxng";
/** Default instance; override with the plugin row's `baseURL` config. */
declare const SEARXNG_DEFAULT_BASE_URL = "https://search.catrambone.org";
/** Hard cap on one unresponsive instance before the call is failed. */
declare const SEARXNG_DEFAULT_TIMEOUT_MS = 15000;
/** Resolved provider options (the plugin's `apply` fills defaults). */
interface SearxngProviderOptions {
  /** Instance base URL; `/search` is appended. */
  baseURL: string;
  /** Whole-request timeout in ms. */
  timeoutMs: number;
  /** Optional comma-separated SEARXNG engine filter (`engines=`). */
  engines?: string;
  /** Optional SEARXNG category filter (`categories=`). */
  categories?: string;
  /** Optional SEARXNG language hint (`language=`). */
  language?: string;
}
/** Minimal SEARXNG JSON envelope: `results[]` plus an optional error message. */
interface SearxngResponse {
  readonly results?: unknown;
  readonly error?: unknown;
}
/**
 * Map one SEARXNG entry to a normalized source. A page without a URL is
 * dropped (there is nothing to cite); title/snippet/date are omitted rather
 * than invented when the instance leaves them blank.
 */
declare function mapSearxngResult(entry: unknown): WebSearchSource | undefined;
/**
 * Map a SEARXNG response envelope to a normalized result, deduplicating by
 * URL. SEARXNG returns no generated answer, so `content` is omitted; the web
 * seam owns `maxResults` truncation, so this reports `truncated: false`.
 */
declare function mapSearxngResponse(response: SearxngResponse): WebSearchResult;
/** The SEARXNG-backed search provider. */
declare class SearxngSearchProvider implements WebSearchProvider {
  private readonly options;
  readonly id = "searxng";
  constructor(options: SearxngProviderOptions);
  available(): boolean;
  search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
//#endregion
//#region src/index.d.ts
/** Cordis plugin name used by loader diagnostics. */
declare const name = "web-search-searxng";
/** The web seam this provider registers into. */
declare const inject: string[];
/** Plugin config (all optional — `apply` fills defaults). */
interface Config {
  /** Instance base URL (`/search` is appended). Defaults to the personal instance. */
  baseURL?: string;
  /** Comma-separated SEARXNG engine filter (`engines=`). */
  engines?: string;
  /** SEARXNG category filter (`categories=`). */
  categories?: string;
  /** SEARXNG language hint (`language=`). */
  language?: string;
  /** Whole-request timeout in ms. Defaults to 15000. */
  timeoutMs?: number;
}
declare const Config: z<Config>;
/** Register the SEARXNG search provider with `ctx.web`. */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, SEARXNG_DEFAULT_BASE_URL, SEARXNG_DEFAULT_TIMEOUT_MS, SEARXNG_PROVIDER_ID, type SearxngProviderOptions, type SearxngResponse, SearxngSearchProvider, apply, inject, mapSearxngResponse, mapSearxngResult, name };
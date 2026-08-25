/**
 * `SearxngSearchProvider`: a `WebSearchProvider` backed by a self-hosted
 * SEARXNG instance's JSON API (`GET {baseURL}/search?q=<query>&format=json`).
 * Maps each `results[]` entry to a normalized source (url/title/snippet/
 * publishedAt), deduplicates by URL (a metasearch instance can return one page
 * under several engines), and omits `content` because SEARXNG returns raw
 * result snippets, not a generated answer.
 * @module dsh-web-search-searxng/provider
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'

/** Stable id this provider registers under. */
export const SEARXNG_PROVIDER_ID = 'searxng'

/** Default instance; override with the plugin row's `baseURL` config. */
export const SEARXNG_DEFAULT_BASE_URL = 'https://search.catrambone.org'

/** Hard cap on one unresponsive instance before the call is failed. */
export const SEARXNG_DEFAULT_TIMEOUT_MS = 15000

/** Safety cap on sources mapped from one response, well above any maxResults. */
export const SEARXNG_MAX_SOURCES = 64

/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = 'deepseek-harness/0.0.1'

/** Resolved provider options (the plugin's `apply` fills defaults). */
export interface SearxngProviderOptions {
  /** Instance base URL; `/search` is appended. */
  baseURL: string
  /** Whole-request timeout in ms. */
  timeoutMs: number
  /** Optional comma-separated SEARXNG engine filter (`engines=`). */
  engines?: string
  /** Optional SEARXNG category filter (`categories=`). */
  categories?: string
  /** Optional SEARXNG language hint (`language=`). */
  language?: string
}

/** Minimal SEARXNG JSON envelope: `results[]` plus an optional error message. */
export interface SearxngResponse {
  readonly results?: unknown
  readonly error?: unknown
}

/**
 * Map one SEARXNG entry to a normalized source. A page without a URL is
 * dropped (there is nothing to cite); title/snippet/date are omitted rather
 * than invented when the instance leaves them blank.
 */
export function mapSearxngResult(entry: unknown): WebSearchSource | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined
  const record = entry as Record<string, unknown>
  const url = typeof record['url'] === 'string' ? record['url'] : ''
  if (url === '') return undefined
  const title = typeof record['title'] === 'string' && record['title'] !== '' ? record['title'] : undefined
  const snippet = typeof record['content'] === 'string' && record['content'] !== '' ? record['content'] : undefined
  const publishedAt = typeof record['publishedDate'] === 'string' && record['publishedDate'] !== ''
    ? record['publishedDate']
    : undefined
  return {
    url,
    ...(title !== undefined ? { title } : {}),
    ...(snippet !== undefined ? { snippet } : {}),
    ...(publishedAt !== undefined ? { publishedAt } : {}),
  }
}

/**
 * Map a SEARXNG response envelope to a normalized result, deduplicating by
 * URL. SEARXNG returns no generated answer, so `content` is omitted; the web
 * seam owns `maxResults` truncation, so this reports `truncated: false`.
 */
export function mapSearxngResponse(response: SearxngResponse): WebSearchResult {
  const sources: WebSearchSource[] = []
  if (!Array.isArray(response.results)) return { sources, truncated: false }
  const seen = new Set<string>()
  for (const entry of response.results) {
    if (sources.length >= SEARXNG_MAX_SOURCES) break
    const source = mapSearxngResult(entry)
    if (source === undefined || seen.has(source.url)) continue
    seen.add(source.url)
    sources.push(source)
  }
  return { sources, truncated: false }
}

/** True when `baseURL` parses as an absolute URL (a cheap local config check). */
function isValidBaseUrl(baseURL: string): boolean {
  return URL.canParse(baseURL)
}

/** True for a caller-cancellation abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** True for our own `AbortSignal.timeout` expiry, surfaced as a provider error. */
function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError'
}

/** The SEARXNG-backed search provider. */
export class SearxngSearchProvider implements WebSearchProvider {
  readonly id = SEARXNG_PROVIDER_ID

  constructor(private readonly options: SearxngProviderOptions) {}

  available(): boolean {
    return isValidBaseUrl(this.options.baseURL) && this.options.timeoutMs > 0
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const url = new URL('/search', this.options.baseURL)
    url.searchParams.set('q', request.query)
    url.searchParams.set('format', 'json')
    if (this.options.engines !== undefined) url.searchParams.set('engines', this.options.engines)
    if (this.options.categories !== undefined) url.searchParams.set('categories', this.options.categories)
    if (this.options.language !== undefined) url.searchParams.set('language', this.options.language)

    const combined = signal !== undefined
      ? AbortSignal.any([signal, AbortSignal.timeout(this.options.timeoutMs)])
      : AbortSignal.timeout(this.options.timeoutMs)

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        headers: {
          'accept': 'application/json',
          'user-agent': USER_AGENT,
        },
        signal: combined,
      })
    } catch (error: unknown) {
      if (isTimeoutError(error)) {
        throw new WebError(`SEARXNG search timed out after ${this.options.timeoutMs}ms`, 'WEB_PROVIDER_ERROR', { cause: error })
      }
      if (isAbortError(error)) throw new WebError('SEARXNG search aborted', 'WEB_ABORTED', { cause: error })
      throw new WebError(`SEARXNG search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      let message = `SEARXNG returned HTTP ${response.status}`
      try {
        const detail = await response.text()
        if (detail !== '') message = `${message}: ${detail.slice(0, 400)}`
      } catch (error: unknown) {
        // A cancellation fired mid-body must surface as its own code, not be
        // swallowed into the HTTP-error message.
        if (isTimeoutError(error)) {
          throw new WebError(`SEARXNG search timed out after ${this.options.timeoutMs}ms`, 'WEB_PROVIDER_ERROR', { cause: error })
        }
        if (isAbortError(error)) throw new WebError('SEARXNG search aborted', 'WEB_ABORTED', { cause: error })
      }
      throw new WebError(message, 'WEB_PROVIDER_ERROR')
    }

    try {
      const payload = await response.json() as SearxngResponse
      if (typeof payload.error === 'string' && payload.error !== '') {
        throw new WebError(`SEARXNG error: ${payload.error}`, 'WEB_PROVIDER_ERROR')
      }
      return mapSearxngResponse(payload)
    } catch (error: unknown) {
      if (error instanceof WebError) throw error
      if (isTimeoutError(error)) {
        throw new WebError(`SEARXNG search timed out after ${this.options.timeoutMs}ms`, 'WEB_PROVIDER_ERROR', { cause: error })
      }
      if (isAbortError(error)) throw new WebError('SEARXNG search aborted', 'WEB_ABORTED', { cause: error })
      throw new WebError(`SEARXNG returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }
}

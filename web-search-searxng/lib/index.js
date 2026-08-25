import z from "@deepseek-ai/schemastery";
import { WebError } from "@deepseek-ai/dsh-web";
//#region src/provider.ts
/**
* `SearxngSearchProvider`: a `WebSearchProvider` backed by a self-hosted
* SEARXNG instance's JSON API (`GET {baseURL}/search?q=<query>&format=json`).
* Maps each `results[]` entry to a normalized source (url/title/snippet/
* publishedAt), deduplicates by URL (a metasearch instance can return one page
* under several engines), and omits `content` because SEARXNG returns raw
* result snippets, not a generated answer.
* @module dsh-web-search-searxng/provider
*/
/** Stable id this provider registers under. */
const SEARXNG_PROVIDER_ID = "searxng";
/** Default instance; override with the plugin row's `baseURL` config. */
const SEARXNG_DEFAULT_BASE_URL = "https://search.catrambone.org";
/** Hard cap on one unresponsive instance before the call is failed. */
const SEARXNG_DEFAULT_TIMEOUT_MS = 15e3;
/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = "deepseek-harness/0.0.1";
/**
* Map one SEARXNG entry to a normalized source. A page without a URL is
* dropped (there is nothing to cite); title/snippet/date are omitted rather
* than invented when the instance leaves them blank.
*/
function mapSearxngResult(entry) {
	if (typeof entry !== "object" || entry === null) return void 0;
	const record = entry;
	const url = typeof record["url"] === "string" ? record["url"] : "";
	if (url === "") return void 0;
	const title = typeof record["title"] === "string" && record["title"] !== "" ? record["title"] : void 0;
	const snippet = typeof record["content"] === "string" && record["content"] !== "" ? record["content"] : void 0;
	const publishedAt = typeof record["publishedDate"] === "string" && record["publishedDate"] !== "" ? record["publishedDate"] : void 0;
	return {
		url,
		...title !== void 0 ? { title } : {},
		...snippet !== void 0 ? { snippet } : {},
		...publishedAt !== void 0 ? { publishedAt } : {}
	};
}
/**
* Map a SEARXNG response envelope to a normalized result, deduplicating by
* URL. SEARXNG returns no generated answer, so `content` is omitted; the web
* seam owns `maxResults` truncation, so this reports `truncated: false`.
*/
function mapSearxngResponse(response) {
	const sources = [];
	if (!Array.isArray(response.results)) return {
		sources,
		truncated: false
	};
	const seen = /* @__PURE__ */ new Set();
	for (const entry of response.results) {
		if (sources.length >= 64) break;
		const source = mapSearxngResult(entry);
		if (source === void 0 || seen.has(source.url)) continue;
		seen.add(source.url);
		sources.push(source);
	}
	return {
		sources,
		truncated: false
	};
}
/** True when `baseURL` parses as an absolute URL (a cheap local config check). */
function isValidBaseUrl(baseURL) {
	return URL.canParse(baseURL);
}
/** True for a caller-cancellation abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error) {
	return error instanceof DOMException && error.name === "AbortError";
}
/** True for our own `AbortSignal.timeout` expiry, surfaced as a provider error. */
function isTimeoutError(error) {
	return error instanceof DOMException && error.name === "TimeoutError";
}
/** The SEARXNG-backed search provider. */
var SearxngSearchProvider = class {
	options;
	id = SEARXNG_PROVIDER_ID;
	constructor(options) {
		this.options = options;
	}
	available() {
		return isValidBaseUrl(this.options.baseURL) && this.options.timeoutMs > 0;
	}
	async search(request, signal) {
		const url = new URL("/search", this.options.baseURL);
		url.searchParams.set("q", request.query);
		url.searchParams.set("format", "json");
		if (this.options.engines !== void 0) url.searchParams.set("engines", this.options.engines);
		if (this.options.categories !== void 0) url.searchParams.set("categories", this.options.categories);
		if (this.options.language !== void 0) url.searchParams.set("language", this.options.language);
		const combined = signal !== void 0 ? AbortSignal.any([signal, AbortSignal.timeout(this.options.timeoutMs)]) : AbortSignal.timeout(this.options.timeoutMs);
		let response;
		try {
			response = await fetch(url, {
				method: "GET",
				redirect: "error",
				headers: {
					"accept": "application/json",
					"user-agent": USER_AGENT
				},
				signal: combined
			});
		} catch (error) {
			if (isTimeoutError(error)) throw new WebError(`SEARXNG search timed out after ${this.options.timeoutMs}ms`, "WEB_PROVIDER_ERROR", { cause: error });
			if (isAbortError(error)) throw new WebError("SEARXNG search aborted", "WEB_ABORTED", { cause: error });
			throw new WebError(`SEARXNG search request failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
		if (!response.ok) {
			let message = `SEARXNG returned HTTP ${response.status}`;
			try {
				const detail = await response.text();
				if (detail !== "") message = `${message}: ${detail.slice(0, 400)}`;
			} catch (error) {
				if (isTimeoutError(error)) throw new WebError(`SEARXNG search timed out after ${this.options.timeoutMs}ms`, "WEB_PROVIDER_ERROR", { cause: error });
				if (isAbortError(error)) throw new WebError("SEARXNG search aborted", "WEB_ABORTED", { cause: error });
			}
			throw new WebError(message, "WEB_PROVIDER_ERROR");
		}
		try {
			const payload = await response.json();
			if (typeof payload.error === "string" && payload.error !== "") throw new WebError(`SEARXNG error: ${payload.error}`, "WEB_PROVIDER_ERROR");
			return mapSearxngResponse(payload);
		} catch (error) {
			if (error instanceof WebError) throw error;
			if (isTimeoutError(error)) throw new WebError(`SEARXNG search timed out after ${this.options.timeoutMs}ms`, "WEB_PROVIDER_ERROR", { cause: error });
			if (isAbortError(error)) throw new WebError("SEARXNG search aborted", "WEB_ABORTED", { cause: error });
			throw new WebError(`SEARXNG returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
		}
	}
};
//#endregion
//#region src/index.ts
/** Cordis plugin name used by loader diagnostics. */
const name = "web-search-searxng";
/** The web seam this provider registers into. */
const inject = ["web"];
const Config = z.object({
	baseURL: z.string(),
	engines: z.string(),
	categories: z.string(),
	language: z.string(),
	timeoutMs: z.number().step(1).min(1)
});
/** Register the SEARXNG search provider with `ctx.web`. */
function apply(ctx, config) {
	ctx.web.registerSearchProvider(new SearxngSearchProvider({
		baseURL: config.baseURL !== void 0 && config.baseURL.trim() !== "" ? config.baseURL.trim() : SEARXNG_DEFAULT_BASE_URL,
		timeoutMs: config.timeoutMs ?? 15e3,
		...config.engines !== void 0 && config.engines.trim() !== "" ? { engines: config.engines.trim() } : {},
		...config.categories !== void 0 && config.categories.trim() !== "" ? { categories: config.categories.trim() } : {},
		...config.language !== void 0 && config.language.trim() !== "" ? { language: config.language.trim() } : {}
	}));
}
//#endregion
export { Config, SEARXNG_DEFAULT_BASE_URL, SEARXNG_DEFAULT_TIMEOUT_MS, SEARXNG_PROVIDER_ID, SearxngSearchProvider, apply, inject, mapSearxngResponse, mapSearxngResult, name };

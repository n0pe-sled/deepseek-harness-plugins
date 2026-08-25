# dsh-web-search-searxng

A host-only [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
plugin that registers a **SEARXNG-backed search provider** with the web
capability seam (`ctx.web`). It sits beside the shipped `web-search-deepseek`,
`web-search-exa`, and `web-search-perplexity` providers; the model-facing
`web_search` tool stays owned by `@deepseek-ai/dsh-tool-web`.

## How it fits

- The seam (`@deepseek-ai/dsh-web`) owns provider selection via the `web` row's
  `searchProvider` config (or `$DSH_WEB_SEARCH_PROVIDER`, or auto-select when
  exactly one usable provider is registered).
- This provider registers under the id `searxng` and calls your instance's
  JSON API: `GET {baseURL}/search?q=<query>&format=json`.
- `web_search` errors route through the seam's `WebError` taxonomy:
  `WEB_ABORTED` on caller cancellation, `WEB_PROVIDER_ERROR` for request,
  timeout, HTTP, or unparseable-response failures.

## Install

Add the bundle to the profile and point the seam at it. From the profile's
patch layer (for example `$DSH_HOME/cordis.patch.yml` on the web profile):

```yaml
- insert:
    - id: web-search-searxng
      name: dsh-web-search-searxng

# Point the seam's search at the SEARXNG provider (replaces the base row's config).
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: searxng
```

then restart the GUI. On the web surface the `web_search` tool itself is
mounted per-session by the agent preset, so no tool enablement is needed.

## Config (plugin row)

| Key | Default | Meaning |
|---|---|---|
| `baseURL` | `https://search.catrambone.org` | Instance base URL; `/search` is appended. |
| `engines` | unset | Comma-separated SEARXNG engine filter (`engines=`). |
| `categories` | unset | SEARXNG category filter (`categories=`). |
| `language` | unset | SEARXNG language hint (`language=`). |
| `timeoutMs` | `15000` | Whole-request timeout in ms. |

```yaml
- id: web-search-searxng
  name: dsh-web-search-searxng
  config:
    baseURL: https://search.catrambone.org
    engines: google,duckduckgo
```

## Mapping

Each `results[]` entry maps to a `WebSearchSource`: `url` (required, else the
entry is dropped), `title`, `snippet` from `content`, and `publishedAt` from
`publishedDate` when the instance returns one. Results are deduplicated by URL
(one page can appear under several engines). SEARXNG returns no generated
answer, so `content` is omitted; `maxResults` truncation is the seam's job.

## Verify

```bash
node tests/smoke.mjs   # mapping, availability, apply registration, local round trip
```

The provider's `search()` has also been exercised directly against a live
instance: `deepseek harness` returns ~28 mapped sources with titles and
snippets.

/**
 * Host-half smoke test for dsh-web-search-searxng, no harness needed.
 *
 * Covers the module contract, the SEARXNG→WebSearchSource mapping (including
 * URL dedup and url-only sources), provider availability, apply-time
 * registration into a stubbed `ctx.web`, and a real `search()` round trip
 * against a local fixture HTTP server (no external network).
 *
 * Run with: node tests/smoke.mjs
 */

import assert from 'node:assert/strict'
import { createServer } from 'node:http'

const lib = await import('../lib/index.js')

let pass = 0
function ok(name) {
  pass += 1
  console.log(`  ✔ ${name}`)
}

/** A fixture SEARXNG JSON response mirroring the real instance's shape. */
const FIXTURE_RESPONSE = {
  query: 'searxng',
  number_of_results: 4,
  results: [
    {
      url: 'https://github.com/searxng/searxng',
      title: 'searxng/searxng',
      content: 'A free internet metasearch engine which aggregates results.',
      publishedDate: '2026-01-02T00:00:00Z',
      engine: 'duckduckgo',
    },
    // Same URL via another engine must be dropped by URL dedup.
    {
      url: 'https://github.com/searxng/searxng',
      title: 'duplicate',
      content: 'same page via google',
      engine: 'google cse',
    },
    // A URL-less entry must be dropped (nothing to cite).
    { url: '', title: 'no url', content: 'x' },
    // A url-only source keeps url and nothing else.
    { url: 'https://docs.searxng.org', title: '', content: '', publishedDate: null },
  ],
}

/** Boot a local JSON fixture server and return { server, url, last } monitor. */
async function bootFixture(status = 200) {
  const last = { path: '', params: new URLSearchParams() }
  const server = createServer((req, res) => {
    last.path = req.url?.split('?')[0] ?? ''
    last.params = new URLSearchParams(req.url?.split('?')[1] ?? '')
    if (status !== 200) {
      res.writeHead(status, { 'content-type': 'text/plain' })
      res.end('boom')
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(FIXTURE_RESPONSE))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address !== null && typeof address === 'object', 'server bound')
  return { server, url: `http://127.0.0.1:${address.port}`, last }
}

console.log('dsh-web-search-searxng smoke:')
try {
  // 1. Module contract -----------------------------------------------------
  assert.equal(typeof lib.Config, 'function', 'Config is a schema function')
  assert.equal(lib.name, 'web-search-searxng', 'name export')
  assert.deepEqual(lib.inject, ['web'], 'inject list')
  assert.equal(lib.SEARXNG_PROVIDER_ID, 'searxng', 'provider id export')
  ok('module contract (name/inject/Config)')

  // 2. Mapping -------------------------------------------------------------
  const mapped = lib.mapSearxngResponse(FIXTURE_RESPONSE)
  assert.equal(mapped.sources.length, 2, 'dedup drops duplicate URL and url-less entry')
  assert.equal(mapped.sources[0]?.url, 'https://github.com/searxng/searxng', 'first source url')
  assert.equal(mapped.sources[0]?.title, 'searxng/searxng', 'title mapped')
  assert.equal(mapped.sources[0]?.snippet, 'A free internet metasearch engine which aggregates results.', 'snippet from content')
  assert.equal(mapped.sources[0]?.publishedAt, '2026-01-02T00:00:00Z', 'publishedDate mapped')
  assert.equal(mapped.sources[1]?.url, 'https://docs.searxng.org', 'url-only source kept')
  assert.deepEqual(Object.keys(mapped.sources[1] ?? {}).sort(), ['url'], 'url-only source carries no invented fields')
  assert.equal(mapped.truncated, false, 'seam owns truncation')
  assert.deepEqual(lib.mapSearxngResponse({}), { sources: [], truncated: false }, 'empty envelope')
  ok('mapping: dedup, snippet/date, url-only, empty')

  // 3. Availability --------------------------------------------------------
  const good = new lib.SearxngSearchProvider({ baseURL: 'https://search.catrambone.org', timeoutMs: 15000 })
  assert.equal(good.id, 'searxng', 'provider id')
  assert.equal(good.available(), true, 'valid base URL is available')
  const bad = new lib.SearxngSearchProvider({ baseURL: 'not a url', timeoutMs: 0 })
  assert.equal(bad.available(), false, 'unparseable base URL is unavailable')
  ok('availability: valid vs unparseable base URL')

  // 4. apply registration --------------------------------------------------
  const registered = []
  const ctx = {
    web: { registerSearchProvider: provider => { registered.push(provider) } },
  }
  lib.apply(ctx, lib.Config({}))
  assert.equal(registered.length, 1, 'one provider registered')
  assert.equal(registered[0]?.id, 'searxng', 'registered searxng provider')
  assert.equal(registered[0]?.available(), true, 'registered provider usable with defaults')
  ok('apply registration with default config')

  // 5. Real search against a local fixture server ---------------------------
  const { server, url, last } = await bootFixture(200)
  try {
    const provider = new lib.SearxngSearchProvider({
      baseURL: url,
      timeoutMs: 5000,
      engines: 'google,duckduckgo',
      categories: 'general',
    })
    const result = await provider.search({ query: 'hello world', maxResults: 10 })
    assert.equal(last.path, '/search', 'hits /search')
    assert.equal(last.params.get('q'), 'hello world', 'q parameter set')
    assert.equal(last.params.get('format'), 'json', 'format=json')
    assert.equal(last.params.get('engines'), 'google,duckduckgo', 'engines passed through')
    assert.equal(last.params.get('categories'), 'general', 'categories passed through')
    assert.equal(result.sources[0]?.title, 'searxng/searxng', 'search result mapped')
    assert.equal(result.sources[0]?.snippet, 'A free internet metasearch engine which aggregates results.', 'search snippet mapped')
    ok('search round trip against fixture server')
  } finally {
    server.close()
  }

  // 6. Non-2xx becomes WEB_PROVIDER_ERROR -----------------------------------
  const { server: eServer, url: eUrl } = await bootFixture(500)
  try {
    const provider = new lib.SearxngSearchProvider({ baseURL: eUrl, timeoutMs: 5000 })
    await assert.rejects(
      () => provider.search({ query: 'x' }),
      error => error !== null && typeof error === 'object' && 'code' in error
        && error.code === 'WEB_PROVIDER_ERROR',
      'HTTP 500 surfaces as WEB_PROVIDER_ERROR',
    )
    ok('non-2xx maps to WEB_PROVIDER_ERROR')
  } finally {
    eServer.close()
  }
} finally {
  // no temp dirs to clean
}

console.log(`\n${pass} checks passed.`)

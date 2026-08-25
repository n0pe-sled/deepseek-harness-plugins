/**
 * tsdown config for dsh-web-search-searxng: a host-only Node ESM build. The
 * provider registers into the `web` seam, so the browser half does not exist.
 * Peers stay external (resolved at runtime from the profile's module
 * fallback); there is nothing to bundle, since this package's only own
 * runtime code is the provider itself.
 */
import { isBuiltin } from 'node:module'

const PRODUCTION_DEPENDENCIES = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/schemastery',
  '@deepseek-ai/dsh-web',
].map(name => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`))

const matchesProduction = (specifier: string): boolean =>
  PRODUCTION_DEPENDENCIES.some(pattern => pattern.test(specifier))

export default [
  {
    name: 'dsh-web-search-searxng',
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: false,
    deps: {
      neverBundle: (specifier: string) => isBuiltin(specifier) || matchesProduction(specifier),
      alwaysBundle: (specifier: string) => !isBuiltin(specifier) && !matchesProduction(specifier),
    },
  },
]

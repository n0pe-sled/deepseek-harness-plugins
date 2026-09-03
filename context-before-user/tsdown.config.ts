/** Host-only Node ESM build for dsh-context-before-user. */
import { isBuiltin } from 'node:module'

const PRODUCTION_DEPENDENCIES = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-session',
]
  .map(name => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`))

const matchesProduction = (specifier: string): boolean =>
  PRODUCTION_DEPENDENCIES.some(pattern => pattern.test(specifier))

export default [{
  name: 'dsh-context-before-user',
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
}]

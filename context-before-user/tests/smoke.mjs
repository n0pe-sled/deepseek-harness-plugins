/** Host-half smoke test for dsh-context-before-user; no harness required. */
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import {
  apply,
  inject,
  name,
  orderContextBeforeUser,
} from '../lib/index.js'

assert.equal(name, 'context-before-user')
assert.deepEqual(inject, ['agents'])

const message = (id, source) => ({ id, role: 'user', content: [{ type: 'text', text: id }], source })
const human = message('human', { kind: 'user' })
const runtime = message('runtime', { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt', form: 'snapshot', sections: [] })
const catalog = message('catalog', { kind: 'skill-catalog', form: 'catalog', entries: [] })
const instructions = message('instructions', { kind: 'plugin', plugin: '@deepseek-ai/dsh-agent-instructions', form: 'instructions' })

const reordered = orderContextBeforeUser({ kind: 'enter', messages: [human, instructions, runtime, catalog] })
assert.equal(reordered.kind, 'enter')
assert.deepEqual(reordered.messages.map(entry => entry.id), ['instructions', 'runtime', 'catalog', 'human'])
assert.equal(reordered.messages.at(-1), human, 'the real human input is the final user-role turn')

const alreadyOrdered = { kind: 'enter', messages: [runtime, catalog, human] }
assert.equal(orderContextBeforeUser(alreadyOrdered), alreadyOrdered, 'already-ordered batches retain identity')
const contextOnly = { kind: 'enter', messages: [runtime, catalog] }
assert.equal(orderContextBeforeUser(contextOnly), contextOnly, 'tool continuations without human input retain identity')
const rejected = { kind: 'reject' }
assert.equal(orderContextBeforeUser(rejected), rejected)

const twoHumans = orderContextBeforeUser({ kind: 'enter', messages: [human, catalog, message('steer', { kind: 'user' })] })
assert.deepEqual(twoHumans.messages.map(entry => entry.id), ['catalog', 'human', 'steer'], 'both partitions are stable')

let listener
let listenerOptions
const ctx = {
  on(event, candidate, options) {
    assert.equal(event, 'agent/pre-step')
    listener = candidate
    listenerOptions = options
  },
}
apply(ctx)
assert.equal(typeof listener, 'function')
assert.deepEqual(listenerOptions, { prepend: true }, 'outer listener sees all downstream injections')

const result = await listener(
  { messages: [human], turn: 1, step: 1, signal: AbortSignal.timeout(1000) },
  async () => ({ kind: 'enter', messages: [human, runtime, catalog] }),
)
assert.deepEqual(result.messages.map(entry => entry.id), ['runtime', 'catalog', 'human'])

// Real Cordis waterfall: a listener registered later appends context after
// next(), while this plugin's prepended outer listener still observes and
// reorders the complete downstream decision.
const realCtx = new Context()
apply(realCtx)
realCtx.on('agent/pre-step', async (_payload, next) => {
  const decision = await next()
  return decision.kind === 'reject'
    ? decision
    : { kind: 'enter', messages: [...decision.messages, catalog] }
})
const integrated = await realCtx.waterfall(
  'agent/pre-step',
  { messages: [human], turn: 1, step: 1, signal: AbortSignal.timeout(1000) },
  async () => ({ kind: 'enter', messages: [human, runtime] }),
)
assert.deepEqual(integrated.messages.map(entry => entry.id), ['runtime', 'catalog', 'human'])

console.log('smoke: all assertions passed')

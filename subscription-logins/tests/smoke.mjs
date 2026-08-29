import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const plugin = await import('../lib/index.js')

const records = new Map([
  ['llm-pi-ai/openai-codex', { kind: 'grant', payload: { token: 'personal' } }],
  ['openai-subscription-oauth/zai-accounts', {
    kind: 'grant',
    payload: { version: 1, active: 'legacy-zai', accounts: [{ id: 'legacy-zai', label: 'Migrated Z.AI' }] },
  }],
  ['openai-subscription-oauth/zai-legacy-zai', { kind: 'api-key', key: 'legacy-zai-secret' }],
])
const inFlight = new Set()
const provided = {}
const contributions = []
const modelProviders = {}
let settingsRevision = 0
let cancelled = false
let openAiLogin = 0

const authorization = {
  describe(key) {
    const provider = String(key).split('/').at(-1)
    const isZai = provider === 'zai'
    return {
      key: String(key),
      label: isZai ? 'Z.AI' : provider === 'anthropic' ? 'Anthropic (Claude Pro/Max)' : 'OpenAI Codex',
      methods: [{
        id: isZai ? 'api-key' : 'oauth',
        label: isZai ? 'Z.AI API key' : provider === 'anthropic' ? 'Sign in with Claude' : 'Sign in with ChatGPT',
      }],
      inFlight: inFlight.has(String(key)),
    }
  },
  async begin(request) {
    const key = String(request.key)
    const provider = key.split('/').at(-1)
    const isZai = provider === 'zai'
    assert.equal(request.method, isZai ? 'api-key' : 'oauth')
    inFlight.add(key)
    if (!isZai) {
      request.interaction.notify({
        message: provider === 'anthropic' ? 'Complete Claude sign-in.' : 'Enter this code on the verification page.',
        url: provider === 'anthropic' ? 'https://example.test/claude' : 'https://example.test/device',
        ...(provider === 'anthropic' ? {} : { code: 'ABCD-EFGH' }),
      })
    }
    const answer = isZai
      ? await request.interaction.prompt({ kind: 'secret', message: 'Enter your Z.AI API key', placeholder: 'ZAI_API_KEY' })
      : provider === 'anthropic'
      ? await request.interaction.prompt({ kind: 'text', message: 'Paste the callback code', placeholder: 'code#state' })
      : await request.interaction.prompt({
        kind: 'select',
        message: 'Choose an account',
        options: [{ id: 'work', label: 'Work' }],
      })
    assert.equal(answer, isZai ? 'zai-secret' : provider === 'anthropic' ? 'claude-code' : 'work')
    if (isZai) records.set(key, { kind: 'api-key', key: answer })
    else if (provider === 'anthropic') records.set(key, { kind: 'grant', payload: { token: 'claude' } })
    else records.set(key, { kind: 'grant', payload: { token: `work-${++openAiLogin}` } })
    inFlight.delete(key)
    return { status: 'authorized' }
  },
  cancel(key) {
    cancelled = true
    inFlight.delete(String(key))
  },
}

const credentials = {
  readRecord: async key => records.get(String(key)),
  describeRecord: async key => ({ configured: records.has(String(key)), writable: true }),
  modifyRecord: async (key, mutate) => {
    const text = String(key)
    const next = await mutate(records.get(text))
    if (next !== undefined) records.set(text, next)
    return records.get(text)
  },
  deleteRecord: async key => { records.delete(String(key)) },
}

const settings = {
  describe: () => [{ ns: 'llm-pi-ai', value: { providers: { ...modelProviders } }, revision: settingsRevision }],
  mutate: async (ns, ops, expectedRevision) => {
    assert.equal(ns, 'llm-pi-ai')
    assert.equal(expectedRevision, settingsRevision)
    for (const op of ops) {
      assert.equal(op.op, 'set')
      assert.deepEqual(op.path.slice(0, 1), ['providers'])
      modelProviders[op.path[1]] = op.value
    }
    settingsRevision += 1
  },
}

const ctx = {
  authorization,
  credentials,
  settings,
  typert: { register: contribution => { contributions.push(contribution) } },
  provide: (name, value) => { provided[name] = value },
  effect: () => () => {},
}

assert.equal(plugin.name, 'subscription-logins')
assert.deepEqual(plugin.inject, ['authorization', 'credentials', 'settings', 'typert'])
plugin.apply(ctx)

assert.equal(contributions.length, 1)
assert.deepEqual(contributions[0].invocations.map(row => row.method), [
  'status', 'begin', 'poll', 'answer', 'cancel', 'selectLogin', 'deleteLogin', 'renameLogin',
])

const receiver = provided.subscriptionOAuth
assert.ok(receiver)

const imported = await receiver.status({ provider: 'openai-codex' })
assert.equal(imported.configured, true)
assert.equal(imported.accounts.length, 1)
assert.equal(imported.accounts[0].label, 'Existing login')
assert.equal(imported.accounts[0].active, true)
const personalId = imported.accounts[0].id

assert.deepEqual(await receiver.renameLogin({ provider: 'openai-codex', accountId: personalId, label: 'Personal' }), { ok: true })
assert.deepEqual(await receiver.begin({ provider: 'openai-codex', label: 'Work' }), { ok: true })
const first = await receiver.poll({ provider: 'openai-codex' })
assert.equal(first.notices[0]?.code, 'ABCD-EFGH')
assert.equal(first.prompt?.prompt.kind, 'select')
assert.deepEqual(await receiver.answer({ provider: 'openai-codex', promptId: first.prompt.id, value: 'work' }), { ok: true })
for (let count = 0; count < 20; count += 1) {
  if ((await receiver.poll({ provider: 'openai-codex' })).settlement === 'authorized') break
  await delay(5)
}

const twoAccounts = await receiver.status({ provider: 'openai-codex' })
assert.deepEqual(modelProviders['openai-codex'], {})
assert.deepEqual(twoAccounts.accounts.map(account => [account.label, account.active]), [
  ['Personal', false],
  ['Work', true],
])
const workId = twoAccounts.accounts.find(account => account.label === 'Work').id

assert.deepEqual(await receiver.selectLogin({ provider: 'openai-codex', accountId: personalId }), { ok: true })
assert.deepEqual(records.get('llm-pi-ai/openai-codex'), { kind: 'grant', payload: { token: 'personal' } })
records.set('llm-pi-ai/openai-codex', { kind: 'grant', payload: { token: 'personal-refreshed' } })
assert.deepEqual(await receiver.selectLogin({ provider: 'openai-codex', accountId: workId }), { ok: true })
assert.deepEqual(await receiver.selectLogin({ provider: 'openai-codex', accountId: personalId }), { ok: true })
assert.deepEqual(records.get('llm-pi-ai/openai-codex'), { kind: 'grant', payload: { token: 'personal-refreshed' } })

assert.deepEqual(await receiver.deleteLogin({ provider: 'openai-codex', accountId: workId }), { ok: true })
assert.deepEqual((await receiver.status({ provider: 'openai-codex' })).accounts.map(account => account.label), ['Personal'])

assert.deepEqual(await receiver.begin({ provider: 'anthropic', label: 'Personal Claude' }), { ok: true })
const claude = await receiver.poll({ provider: 'anthropic' })
assert.equal(claude.notices[0]?.url, 'https://example.test/claude')
assert.equal(claude.prompt?.prompt.kind, 'text')
assert.deepEqual(await receiver.answer({ provider: 'anthropic', promptId: claude.prompt.id, value: 'claude-code' }), { ok: true })
for (let count = 0; count < 20; count += 1) {
  if ((await receiver.poll({ provider: 'anthropic' })).settlement === 'authorized') break
  await delay(5)
}
assert.deepEqual((await receiver.status({ provider: 'anthropic' })).accounts.map(account => account.label), ['Personal Claude'])
assert.deepEqual(modelProviders.anthropic, {})
assert.deepEqual(await receiver.cancel({ provider: 'anthropic' }), { ok: true })
assert.equal(cancelled, true)

const zaiStatus = await receiver.status({ provider: 'zai' })
assert.equal(zaiStatus.available, true)
assert.equal(zaiStatus.configured, false)
assert.equal(zaiStatus.methodLabel, 'Z.AI API key')
assert.deepEqual(zaiStatus.accounts.map(account => [account.label, account.active]), [['Migrated Z.AI', false]])
assert.deepEqual(records.get('subscription-logins/zai-legacy-zai'), { kind: 'api-key', key: 'legacy-zai-secret' })
assert.deepEqual(await receiver.begin({ provider: 'zai', label: 'Z.AI Work' }), { ok: true })
const zai = await receiver.poll({ provider: 'zai' })
assert.equal(zai.prompt?.prompt.kind, 'secret')
assert.deepEqual(await receiver.answer({ provider: 'zai', promptId: zai.prompt.id, value: 'zai-secret' }), { ok: true })
for (let count = 0; count < 20; count += 1) {
  if ((await receiver.poll({ provider: 'zai' })).settlement === 'authorized') break
  await delay(5)
}
const configuredZai = await receiver.status({ provider: 'zai' })
assert.deepEqual(configuredZai.accounts.map(account => [account.label, account.active]), [
  ['Migrated Z.AI', false],
  ['Z.AI Work', true],
])
assert.deepEqual(records.get('llm-pi-ai/zai'), { kind: 'api-key', key: 'zai-secret' })
assert.deepEqual(modelProviders.zai, {})

console.log('subscription credential multi-account smoke test passed')

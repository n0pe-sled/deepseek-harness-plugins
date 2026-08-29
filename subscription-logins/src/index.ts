import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type {
  AuthorizationInteraction,
  AuthorizationNotice,
  AuthorizationPrompt,
} from '@deepseek-ai/dsh-authorization'
import type {} from '@deepseek-ai/dsh-authorization'
import { credentialKey, parseCredentialKey } from '@deepseek-ai/dsh-credentials'
import type { CredentialKey, CredentialRecord } from '@deepseek-ai/dsh-credentials'
import { SettingsConflictError, settingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-settings'
import type { TypertContribution, TypertPackageModel } from '@deepseek-ai/dsh-typert-registry'
import { bindTypertRemote, type TypertGatewayBinding } from '@deepseek-ai/dsh-typert-protocol'
import {
  CREDENTIAL_KEYS,
  DESCRIPTORS,
  SERVICE,
  type ActionOutcome,
  type AccountInput,
  type AnswerInput,
  type AuthNotice,
  type AuthPoll,
  type AuthPrompt,
  type AuthStatus,
  type BeginInput,
  type PendingPrompt,
  type ProviderId,
  type ProviderInput,
  type RenameInput,
} from './shared/remote.ts'

export const name = 'subscription-logins'
export const inject = ['authorization', 'credentials', 'settings', 'typert']

const ARCHIVE_SCOPE = 'subscription-logins'
const LEGACY_ARCHIVE_SCOPE = 'openai-subscription-oauth'
const MODEL_SETTINGS = settingsNamespace('llm-pi-ai')
const EMPTY_MODEL: TypertPackageModel = { services: [], events: [], objects: [] }
const PROVIDERS = {
  'openai-codex': {
    key: parseCredentialKey(CREDENTIAL_KEYS['openai-codex']),
    method: 'oauth',
    fallbackLabel: 'OpenAI Codex',
    unavailable: 'The openai-codex OAuth flow is unavailable. Check that the llm-pi-ai plugin is mounted.',
    busy: 'A ChatGPT sign-in is already running.',
  },
  anthropic: {
    key: parseCredentialKey(CREDENTIAL_KEYS.anthropic),
    method: 'oauth',
    fallbackLabel: 'Anthropic',
    unavailable: 'The Anthropic OAuth flow is unavailable. Check that the llm-pi-ai plugin is mounted.',
    busy: 'A Claude sign-in is already running.',
  },
  zai: {
    key: parseCredentialKey(CREDENTIAL_KEYS.zai),
    method: 'api-key',
    fallbackLabel: 'Z.AI',
    unavailable: 'The Z.AI API key flow is unavailable. Check that the llm-pi-ai plugin is mounted.',
    busy: 'A Z.AI sign-in is already running.',
  },
} as const

interface PromptResolver {
  readonly id: string
  readonly view: PendingPrompt
  resolve(value: string): void
  reject(error: unknown): void
}

interface Attempt {
  readonly controller: AbortController
  notices: AuthNotice[]
  prompt?: PromptResolver
  settlement: AuthPoll['settlement']
  message?: string
  readonly accountId: string
  readonly accountLabel: string
}

interface AccountEntry {
  readonly id: string
  readonly label: string
}

interface AccountIndex {
  readonly version: 1
  readonly active: string | null
  readonly accounts: readonly AccountEntry[]
}

interface OAuthReceiver {
  typertRemote: TypertGatewayBinding<OAuthReceiver>
  status(input: ProviderInput): Promise<AuthStatus>
  begin(input: BeginInput): Promise<ActionOutcome>
  poll(input: ProviderInput): Promise<AuthPoll>
  answer(input: AnswerInput): Promise<ActionOutcome>
  cancel(input: ProviderInput): Promise<ActionOutcome>
  selectLogin(input: AccountInput): Promise<ActionOutcome>
  deleteLogin(input: AccountInput): Promise<ActionOutcome>
  renameLogin(input: RenameInput): Promise<ActionOutcome>
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function noticeView(notice: AuthorizationNotice): AuthNotice {
  return {
    message: notice.message,
    ...(notice.url === undefined ? {} : { url: notice.url }),
    ...(notice.code === undefined ? {} : { code: notice.code }),
  }
}

function promptView(prompt: AuthorizationPrompt): AuthPrompt {
  if (prompt.kind === 'select') {
    return {
      kind: 'select',
      message: prompt.message,
      options: prompt.options.map(option => ({
        id: option.id,
        label: option.label,
        ...(option.description === undefined ? {} : { description: option.description }),
      })),
    }
  }
  return {
    kind: prompt.kind,
    message: prompt.message,
    ...(prompt.placeholder === undefined ? {} : { placeholder: prompt.placeholder }),
  }
}

function accountIndex(value: unknown): AccountIndex {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { version: 1, active: null, accounts: [] }
  const candidate = value as Record<string, unknown>
  if (candidate.version !== 1 || (candidate.active !== null && typeof candidate.active !== 'string') || !Array.isArray(candidate.accounts)) {
    return { version: 1, active: null, accounts: [] }
  }
  const accounts: AccountEntry[] = []
  for (const entry of candidate.accounts) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
    const row = entry as Record<string, unknown>
    if (typeof row.id !== 'string' || !/^[a-z0-9-]+$/.test(row.id) || typeof row.label !== 'string') continue
    accounts.push({ id: row.id, label: row.label })
  }
  const active = typeof candidate.active === 'string' && accounts.some(entry => entry.id === candidate.active)
    ? candidate.active
    : null
  return { version: 1, active, accounts }
}

function accountId(): string {
  return `account-${randomUUID()}`
}

function isProviderCredential(record: CredentialRecord | undefined): record is CredentialRecord {
  return record?.kind === 'grant' || record?.kind === 'api-key'
}

export function apply(ctx: Context): void {
  const attempts = new Map<ProviderId, Attempt>()
  const queues = new Map<ProviderId, Promise<unknown>>()

  const serial = async <T>(provider: ProviderId, operation: () => Promise<T>): Promise<T> => {
    const prior = queues.get(provider) ?? Promise.resolve()
    const next = prior.catch(() => {}).then(operation)
    queues.set(provider, next)
    try {
      return await next
    } finally {
      if (queues.get(provider) === next) queues.delete(provider)
    }
  }

  const indexKey = (provider: ProviderId): CredentialKey => credentialKey(ARCHIVE_SCOPE, `${provider}-accounts`)
  const archiveKey = (provider: ProviderId, id: string): CredentialKey => credentialKey(ARCHIVE_SCOPE, `${provider}-${id}`)
  const legacyIndexKey = (provider: ProviderId): CredentialKey => credentialKey(LEGACY_ARCHIVE_SCOPE, `${provider}-accounts`)
  const legacyArchiveKey = (provider: ProviderId, id: string): CredentialKey => credentialKey(LEGACY_ARCHIVE_SCOPE, `${provider}-${id}`)

  const writeRecord = (key: CredentialKey, record: CredentialRecord): Promise<CredentialRecord | undefined> =>
    ctx.credentials.modifyRecord(key, async () => record)

  const writeIndex = (provider: ProviderId, index: AccountIndex): Promise<CredentialRecord | undefined> =>
    writeRecord(indexKey(provider), { kind: 'grant', payload: index })

  const readIndex = async (provider: ProviderId): Promise<AccountIndex> => {
    const record = await ctx.credentials.readRecord(indexKey(provider))
    if (record?.kind === 'grant') return accountIndex(record.payload)

    const legacy = await ctx.credentials.readRecord(legacyIndexKey(provider))
    if (legacy?.kind !== 'grant') return { version: 1, active: null, accounts: [] }
    const migrated = accountIndex(legacy.payload)
    for (const account of migrated.accounts) {
      const archived = await ctx.credentials.readRecord(legacyArchiveKey(provider, account.id))
      if (isProviderCredential(archived)) await writeRecord(archiveKey(provider, account.id), archived)
    }
    await writeIndex(provider, migrated)
    return migrated
  }

  const ensureManaged = async (provider: ProviderId): Promise<AccountIndex> => {
    const selected = PROVIDERS[provider]
    const canonical = await ctx.credentials.readRecord(selected.key)
    let index = await readIndex(provider)

    const present: AccountEntry[] = []
    for (const account of index.accounts) {
      const archived = await ctx.credentials.readRecord(archiveKey(provider, account.id))
      if (isProviderCredential(archived)) present.push(account)
    }
    const pruned = present.length !== index.accounts.length
    if (pruned) {
      index = {
        version: 1,
        active: present.some(account => account.id === index.active) ? index.active : null,
        accounts: present,
      }
    }

    if (isProviderCredential(canonical) && index.active === null) {
      const id = accountId()
      await writeRecord(archiveKey(provider, id), canonical)
      index = { version: 1, active: id, accounts: [...index.accounts, { id, label: 'Existing login' }] }
      await writeIndex(provider, index)
      return index
    }
    if (!isProviderCredential(canonical) && index.active !== null) {
      index = { ...index, active: null }
      await writeIndex(provider, index)
      return index
    }
    if (isProviderCredential(canonical) && index.active !== null) {
      const archived = await ctx.credentials.readRecord(archiveKey(provider, index.active))
      if (!isProviderCredential(archived)) await writeRecord(archiveKey(provider, index.active), canonical)
    }
    if (pruned) await writeIndex(provider, index)
    return index
  }

  const syncActive = async (provider: ProviderId, index: AccountIndex): Promise<void> => {
    if (index.active === null) return
    const current = await ctx.credentials.readRecord(PROVIDERS[provider].key)
    if (isProviderCredential(current)) await writeRecord(archiveKey(provider, index.active), current)
  }

  const ensureModelProvider = async (provider: ProviderId): Promise<void> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const descriptor = ctx.settings.describe().find(candidate => candidate.ns === MODEL_SETTINGS)
      if (descriptor === undefined) throw new Error('The llm-pi-ai settings namespace is unavailable.')
      const value = descriptor.value as { providers?: unknown }
      const providers = typeof value.providers === 'object' && value.providers !== null && !Array.isArray(value.providers)
        ? value.providers as Record<string, unknown>
        : {}
      if (Object.hasOwn(providers, provider)) return
      try {
        await ctx.settings.mutate(
          MODEL_SETTINGS,
          [{ op: 'set', path: ['providers', provider], value: {} }],
          descriptor.revision,
        )
        return
      } catch (error) {
        if (error instanceof SettingsConflictError) continue
        throw error
      }
    }
    throw new Error(`The ${provider} model provider changed concurrently and could not be added.`)
  }

  const finalizeLogin = (provider: ProviderId, attempt: Attempt): Promise<void> => serial(provider, async () => {
    const current = await ctx.credentials.readRecord(PROVIDERS[provider].key)
    if (!isProviderCredential(current)) throw new Error('The provider completed sign-in without storing a credential.')
    await writeRecord(archiveKey(provider, attempt.accountId), current)
    const index = await readIndex(provider)
    const accounts = index.accounts.filter(account => account.id !== attempt.accountId)
    accounts.push({ id: attempt.accountId, label: attempt.accountLabel })
    await writeIndex(provider, { version: 1, active: attempt.accountId, accounts })
    try {
      await ensureModelProvider(provider)
    } catch (error) {
      attempt.notices.push({
        message: `Login saved, but DSH could not add the ${provider} model provider automatically: ${messageOf(error)}`,
      })
    }
  })

  const status = async (provider: ProviderId): Promise<AuthStatus> => {
    const selected = PROVIDERS[provider]
    const flow = ctx.authorization.describe(selected.key)
    const index = await serial(provider, () => ensureManaged(provider))
    const method = flow?.methods.find(candidate => candidate.id === selected.method)
    return {
      available: method !== undefined,
      configured: index.active !== null,
      inFlight: flow?.inFlight ?? false,
      label: flow?.label ?? selected.fallbackLabel,
      methodLabel: method?.label ?? 'Add subscription credential',
      accounts: index.accounts.map(account => ({ ...account, active: account.id === index.active })),
    }
  }

  const receiver: OAuthReceiver = {
    typertRemote: undefined as unknown as TypertGatewayBinding<OAuthReceiver>,
    status: input => status(input.provider),
    begin: async (input) => {
      const selected = PROVIDERS[input.provider]
      const flow = ctx.authorization.describe(selected.key)
      if (flow === undefined || !flow.methods.some(candidate => candidate.id === selected.method)) {
        return { ok: false, error: selected.unavailable }
      }
      const attempt = attempts.get(input.provider)
      if (flow.inFlight || (attempt !== undefined && attempt.settlement === null)) {
        return { ok: false, error: selected.busy }
      }

      const index = await serial(input.provider, () => ensureManaged(input.provider))
      if (index.accounts.some(account => account.label.localeCompare(input.label, undefined, { sensitivity: 'accent' }) === 0)) {
        return { ok: false, error: `A saved login already uses the name "${input.label}".` }
      }
      await serial(input.provider, () => syncActive(input.provider, index))

      const current: Attempt = {
        controller: new AbortController(),
        notices: [],
        settlement: null,
        accountId: accountId(),
        accountLabel: input.label,
      }
      attempts.set(input.provider, current)
      const interaction: AuthorizationInteraction = {
        notify(notice) {
          current.notices.push(noticeView(notice))
        },
        prompt(prompt) {
          return new Promise<string>((resolve, reject) => {
            const id = randomUUID()
            const pending: PromptResolver = { id, view: { id, prompt: promptView(prompt) }, resolve, reject }
            current.prompt = pending
            prompt.signal?.addEventListener('abort', () => {
              if (current.prompt?.id !== id) return
              delete current.prompt
              reject(new Error('authorization prompt withdrawn'))
            }, { once: true })
          })
        },
      }

      void ctx.authorization.begin({
        key: selected.key,
        method: selected.method,
        interaction,
        signal: current.controller.signal,
      }).then(async outcome => {
          if (outcome.status === 'authorized') await finalizeLogin(input.provider, current)
          current.settlement = outcome.status
        }).catch(error => {
          current.settlement = 'failed'
          current.message = messageOf(error)
        })
      return { ok: true }
    },
    poll: (input) => {
      const attempt = attempts.get(input.provider)
      if (attempt === undefined) {
        return Promise.resolve({ notices: [], prompt: null, settlement: null })
      }
      const notices = attempt.notices
      attempt.notices = []
      return Promise.resolve({
        notices,
        prompt: attempt.prompt?.view ?? null,
        settlement: attempt.settlement,
        ...(attempt.message === undefined ? {} : { message: attempt.message }),
      })
    },
    answer: (input) => {
      const attempt = attempts.get(input.provider)
      const pending = attempt?.prompt
      if (pending === undefined || pending.id !== input.promptId) {
        return Promise.resolve({ ok: false, error: 'That sign-in question is no longer waiting for an answer.' })
      }
      delete attempt?.prompt
      pending.resolve(input.value)
      return Promise.resolve({ ok: true })
    },
    cancel: (input) => {
      const selected = PROVIDERS[input.provider]
      const current = attempts.get(input.provider)
      if (current !== undefined) {
        current.controller.abort('cancelled by user')
        current.prompt?.reject(new Error('authorization cancelled'))
        delete current.prompt
      }
      ctx.authorization.cancel(selected.key)
      return Promise.resolve({ ok: true })
    },
    selectLogin: async (input) => {
      try {
        const attempt = attempts.get(input.provider)
        if (attempt?.settlement === null) return { ok: false, error: 'Wait for the current sign-in to finish or cancel it first.' }
        await serial(input.provider, async () => {
          const index = await ensureManaged(input.provider)
          const selected = index.accounts.find(account => account.id === input.accountId)
          if (selected === undefined) throw new Error('That saved login no longer exists.')
          if (index.active === input.accountId) return
          await syncActive(input.provider, index)
          const archived = await ctx.credentials.readRecord(archiveKey(input.provider, input.accountId))
          if (!isProviderCredential(archived)) throw new Error('That saved login has no provider credential.')
          await writeRecord(PROVIDERS[input.provider].key, archived)
          await writeIndex(input.provider, { ...index, active: input.accountId })
        })
        return { ok: true }
      } catch (error) {
        return { ok: false, error: messageOf(error) }
      }
    },
    deleteLogin: async (input) => {
      try {
        const attempt = attempts.get(input.provider)
        if (attempt?.settlement === null) return { ok: false, error: 'Wait for the current sign-in to finish or cancel it first.' }
        await serial(input.provider, async () => {
          const index = await ensureManaged(input.provider)
          if (!index.accounts.some(account => account.id === input.accountId)) throw new Error('That saved login no longer exists.')
          if (index.active === input.accountId) await ctx.credentials.deleteRecord(PROVIDERS[input.provider].key)
          await ctx.credentials.deleteRecord(archiveKey(input.provider, input.accountId))
          await writeIndex(input.provider, {
            version: 1,
            active: index.active === input.accountId ? null : index.active,
            accounts: index.accounts.filter(account => account.id !== input.accountId),
          })
        })
        return { ok: true }
      } catch (error) {
        return { ok: false, error: messageOf(error) }
      }
    },
    renameLogin: async (input) => {
      try {
        await serial(input.provider, async () => {
          const index = await ensureManaged(input.provider)
          if (!index.accounts.some(account => account.id === input.accountId)) throw new Error('That saved login no longer exists.')
          if (index.accounts.some(account => account.id !== input.accountId
            && account.label.localeCompare(input.label, undefined, { sensitivity: 'accent' }) === 0)) {
            throw new Error(`A saved login already uses the name "${input.label}".`)
          }
          await writeIndex(input.provider, {
            ...index,
            accounts: index.accounts.map(account => account.id === input.accountId ? { ...account, label: input.label } : account),
          })
        })
        return { ok: true }
      } catch (error) {
        return { ok: false, error: messageOf(error) }
      }
    },
  }

  receiver.typertRemote = bindTypertRemote(receiver, SERVICE, { namespace: SERVICE })
  ctx.provide(SERVICE, receiver)
  const contribution: TypertContribution = {
    package: 'dsh-subscription-logins',
    face: 'host',
    schemas: [],
    model: EMPTY_MODEL,
    invocations: [...DESCRIPTORS],
  }
  ctx.typert.register(contribution)

  ctx.effect(() => () => {
    for (const [provider, attempt] of attempts) {
      attempt.controller.abort('plugin stopped')
      attempt.prompt?.reject(new Error('authorization plugin stopped'))
      ctx.authorization.cancel(PROVIDERS[provider].key)
    }
  }, 'subscription-oauth: cancel attempts on stop')
}

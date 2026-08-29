import type { InvocationDescriptor, RemoteResult, TypertSchema } from '@deepseek-ai/dsh-typert-protocol'

export const SERVICE = 'subscriptionOAuth'

export type ProviderId = 'openai-codex' | 'anthropic' | 'zai'

export const CREDENTIAL_KEYS: Readonly<Record<ProviderId, string>> = {
  'openai-codex': 'llm-pi-ai/openai-codex',
  anthropic: 'llm-pi-ai/anthropic',
  zai: 'llm-pi-ai/zai',
}

export interface ProviderInput {
  readonly provider: ProviderId
}

export interface BeginInput extends ProviderInput {
  readonly label: string
}

export interface AccountInput extends ProviderInput {
  readonly accountId: string
}

export interface RenameInput extends AccountInput {
  readonly label: string
}

export interface AnswerInput extends ProviderInput {
  readonly promptId: string
  readonly value: string
}

export interface AuthStatus {
  readonly available: boolean
  readonly configured: boolean
  readonly inFlight: boolean
  readonly label: string
  readonly methodLabel: string
  readonly accounts: readonly AccountSummary[]
}

export interface AccountSummary {
  readonly id: string
  readonly label: string
  readonly active: boolean
}

export interface AuthNotice {
  readonly message: string
  readonly url?: string
  readonly code?: string
}

export interface AuthPromptOption {
  readonly id: string
  readonly label: string
  readonly description?: string
}

export type AuthPrompt =
  | { readonly kind: 'select'; readonly message: string; readonly options: readonly AuthPromptOption[] }
  | { readonly kind: 'text' | 'secret'; readonly message: string; readonly placeholder?: string }

export interface PendingPrompt {
  readonly id: string
  readonly prompt: AuthPrompt
}

export interface AuthPoll {
  readonly notices: readonly AuthNotice[]
  readonly prompt: PendingPrompt | null
  readonly settlement: 'authorized' | 'cancelled' | 'failed' | null
  readonly message?: string
}

export type ActionOutcome = { readonly ok: true } | { readonly ok: false; readonly error: string }

export type RemoteCallOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

const PREFIX = `dsh-subscription-logins#${SERVICE}.`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function parseProvider(value: unknown): ProviderInput {
  if (!isRecord(value)
    || (value.provider !== 'openai-codex' && value.provider !== 'anthropic' && value.provider !== 'zai')) {
    throw new TypeError('input must contain a supported provider')
  }
  return { provider: value.provider }
}

function parseAnswer(value: unknown): AnswerInput {
  if (!isRecord(value)) throw new TypeError('answer input must be an object')
  const provider = parseProvider(value)
  if (typeof value.promptId !== 'string' || value.promptId === '' || typeof value.value !== 'string') {
    throw new TypeError('answer input must contain a supported provider, non-empty promptId, and string value')
  }
  return { provider: provider.provider, promptId: value.promptId, value: value.value }
}

function parseLabelInput(value: unknown): BeginInput {
  if (!isRecord(value)) throw new TypeError('login input must be an object')
  const provider = parseProvider(value)
  if (typeof value.label !== 'string' || value.label.trim() === '' || value.label.trim().length > 40) {
    throw new TypeError('login label must contain 1 to 40 characters')
  }
  return { provider: provider.provider, label: value.label.trim() }
}

function parseAccountInput(value: unknown): AccountInput {
  if (!isRecord(value)) throw new TypeError('account input must be an object')
  const provider = parseProvider(value)
  if (typeof value.accountId !== 'string' || !/^[a-z0-9-]+$/.test(value.accountId)) {
    throw new TypeError('account input must contain a valid accountId')
  }
  return { provider: provider.provider, accountId: value.accountId }
}

function parseRename(value: unknown): RenameInput {
  if (!isRecord(value)) throw new TypeError('rename input must be an object')
  const account = parseAccountInput(value)
  const named = parseLabelInput(value)
  return { ...account, label: named.label }
}

function parseStatus(value: unknown): AuthStatus {
  if (!isRecord(value)
    || typeof value.available !== 'boolean'
    || typeof value.configured !== 'boolean'
    || typeof value.inFlight !== 'boolean'
    || typeof value.label !== 'string'
    || typeof value.methodLabel !== 'string'
    || !Array.isArray(value.accounts)) {
    throw new TypeError('authorization status has invalid fields')
  }
  const accounts = value.accounts.map((account): AccountSummary => {
    if (!isRecord(account)
      || typeof account.id !== 'string'
      || typeof account.label !== 'string'
      || typeof account.active !== 'boolean') {
      throw new TypeError('authorization account has invalid fields')
    }
    return { id: account.id, label: account.label, active: account.active }
  })
  return {
    available: value.available,
    configured: value.configured,
    inFlight: value.inFlight,
    label: value.label,
    methodLabel: value.methodLabel,
    accounts,
  }
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`)
  return value
}

function parseNotice(value: unknown): AuthNotice {
  if (!isRecord(value) || typeof value.message !== 'string') throw new TypeError('authorization notice is invalid')
  const url = optionalString(value.url, 'notice url')
  const code = optionalString(value.code, 'notice code')
  return { message: value.message, ...(url === undefined ? {} : { url }), ...(code === undefined ? {} : { code }) }
}

function parsePrompt(value: unknown): AuthPrompt {
  if (!isRecord(value) || typeof value.kind !== 'string' || typeof value.message !== 'string') {
    throw new TypeError('authorization prompt is invalid')
  }
  if (value.kind === 'select') {
    if (!Array.isArray(value.options)) throw new TypeError('select prompt options must be an array')
    const options = value.options.map((option): AuthPromptOption => {
      if (!isRecord(option) || typeof option.id !== 'string' || typeof option.label !== 'string') {
        throw new TypeError('select prompt option is invalid')
      }
      const description = optionalString(option.description, 'option description')
      return { id: option.id, label: option.label, ...(description === undefined ? {} : { description }) }
    })
    return { kind: 'select', message: value.message, options }
  }
  if (value.kind !== 'text' && value.kind !== 'secret') throw new TypeError('authorization prompt kind is invalid')
  const placeholder = optionalString(value.placeholder, 'prompt placeholder')
  return { kind: value.kind, message: value.message, ...(placeholder === undefined ? {} : { placeholder }) }
}

function parsePoll(value: unknown): AuthPoll {
  if (!isRecord(value) || !Array.isArray(value.notices)) throw new TypeError('authorization poll is invalid')
  const notices = value.notices.map(parseNotice)
  let prompt: PendingPrompt | null = null
  if (value.prompt !== null) {
    if (!isRecord(value.prompt) || typeof value.prompt.id !== 'string') throw new TypeError('pending prompt is invalid')
    prompt = { id: value.prompt.id, prompt: parsePrompt(value.prompt.prompt) }
  }
  const settlements = new Set([null, 'authorized', 'cancelled', 'failed'])
  if (!settlements.has(value.settlement as null | string)) throw new TypeError('authorization settlement is invalid')
  const message = optionalString(value.message, 'settlement message')
  return {
    notices,
    prompt,
    settlement: value.settlement as AuthPoll['settlement'],
    ...(message === undefined ? {} : { message }),
  }
}

function parseAction(value: unknown): ActionOutcome {
  if (!isRecord(value) || typeof value.ok !== 'boolean') throw new TypeError('action outcome is invalid')
  if (value.ok) return { ok: true }
  if (typeof value.error !== 'string') throw new TypeError('action error must be a string')
  return { ok: false, error: value.error }
}

type Boundary<T> = TypertSchema<T>
const PROVIDER: Boundary<ProviderInput> = { parse: parseProvider }
const BEGIN: Boundary<BeginInput> = { parse: parseLabelInput }
const ACCOUNT: Boundary<AccountInput> = { parse: parseAccountInput }
const RENAME: Boundary<RenameInput> = { parse: parseRename }
const ANSWER: Boundary<AnswerInput> = { parse: parseAnswer }
const STATUS: Boundary<AuthStatus> = { parse: parseStatus }
const POLL: Boundary<AuthPoll> = { parse: parsePoll }
const ACTION: Boundary<ActionOutcome> = { parse: parseAction }

function descriptor<I, R>(method: string, input: Boundary<I>, result: Boundary<R>): InvocationDescriptor {
  return {
    id: `${PREFIX}${method}`,
    service: SERVICE,
    namespace: SERVICE,
    method,
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'input',
      wire: 'input',
      source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PREFIX}${method}Input`, schema: input },
    }],
    result: { mode: 'strict', typeSymbol: `${PREFIX}${method}Result`, schema: result },
  }
}

export const DESCRIPTORS: readonly InvocationDescriptor[] = [
  descriptor('status', PROVIDER, STATUS),
  descriptor('begin', BEGIN, ACTION),
  descriptor('poll', PROVIDER, POLL),
  descriptor('answer', ANSWER, ACTION),
  descriptor('cancel', PROVIDER, ACTION),
  descriptor('selectLogin', ACCOUNT, ACTION),
  descriptor('deleteLogin', ACCOUNT, ACTION),
  descriptor('renameLogin', RENAME, ACTION),
]

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'subscriptionOAuth/status'(input: ProviderInput): Promise<RemoteResult<AuthStatus>>
    'subscriptionOAuth/begin'(input: BeginInput): Promise<RemoteResult<ActionOutcome>>
    'subscriptionOAuth/poll'(input: ProviderInput): Promise<RemoteResult<AuthPoll>>
    'subscriptionOAuth/answer'(input: AnswerInput): Promise<RemoteResult<ActionOutcome>>
    'subscriptionOAuth/cancel'(input: ProviderInput): Promise<RemoteResult<ActionOutcome>>
    'subscriptionOAuth/selectLogin'(input: AccountInput): Promise<RemoteResult<ActionOutcome>>
    'subscriptionOAuth/deleteLogin'(input: AccountInput): Promise<RemoteResult<ActionOutcome>>
    'subscriptionOAuth/renameLogin'(input: RenameInput): Promise<RemoteResult<ActionOutcome>>
  }
  interface TypertRemoteNamespaceMap {
    subscriptionOAuth: {
      status(input: ProviderInput): Promise<RemoteResult<AuthStatus>>
      begin(input: BeginInput): Promise<RemoteResult<ActionOutcome>>
      poll(input: ProviderInput): Promise<RemoteResult<AuthPoll>>
      answer(input: AnswerInput): Promise<RemoteResult<ActionOutcome>>
      cancel(input: ProviderInput): Promise<RemoteResult<ActionOutcome>>
      selectLogin(input: AccountInput): Promise<RemoteResult<ActionOutcome>>
      deleteLogin(input: AccountInput): Promise<RemoteResult<ActionOutcome>>
      renameLogin(input: RenameInput): Promise<RemoteResult<ActionOutcome>>
    }
  }
}

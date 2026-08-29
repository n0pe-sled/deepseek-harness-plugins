import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { OAuthSection, type OAuthSectionInjected } from './OAuthSection.tsx'
import {
  DESCRIPTORS,
  SERVICE,
  type ActionOutcome,
  type AccountInput,
  type AnswerInput,
  type AuthPoll,
  type AuthStatus,
  type BeginInput,
  type ProviderInput,
  type RenameInput,
  type RemoteCallOutcome,
} from '../shared/remote.ts'

interface OAuthNamespace {
  status(input: ProviderInput): Promise<RemoteResult<AuthStatus>>
  begin(input: BeginInput): Promise<RemoteResult<ActionOutcome>>
  poll(input: ProviderInput): Promise<RemoteResult<AuthPoll>>
  answer(input: AnswerInput): Promise<RemoteResult<ActionOutcome>>
  cancel(input: ProviderInput): Promise<RemoteResult<ActionOutcome>>
  selectLogin(input: AccountInput): Promise<RemoteResult<ActionOutcome>>
  deleteLogin(input: AccountInput): Promise<RemoteResult<ActionOutcome>>
  renameLogin(input: RenameInput): Promise<RemoteResult<ActionOutcome>>
}

export const inject = ['slots', 'remote']

export function apply(ctx: ClientContext): void {
  const mount = ctx.remote.$mount({
    package: 'dsh-subscription-logins',
    descriptors: [...DESCRIPTORS],
  })
  mount.catch(() => {})

  const call = async <R>(invoke: (namespace: OAuthNamespace) => Promise<RemoteResult<R>>): Promise<RemoteCallOutcome<R>> => {
    try {
      await mount
      const namespace = ctx.get(`remote.${SERVICE}`) as OAuthNamespace | undefined
      if (namespace === undefined) return { ok: false, error: 'Subscription login is unavailable.' }
      const result = await invoke(namespace)
      return result.ok
        ? { ok: true, value: result.value }
        : { ok: false, error: `${result.error.message} (${result.error.code})` }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  const injected = (): OAuthSectionInjected => ({
    status: input => call(namespace => namespace.status(input)),
    begin: input => call(namespace => namespace.begin(input)),
    poll: input => call(namespace => namespace.poll(input)),
    answer: input => call(namespace => namespace.answer(input)),
    cancel: input => call(namespace => namespace.cancel(input)),
    activate: input => call(namespace => namespace.selectLogin(input)),
    remove: input => call(namespace => namespace.deleteLogin(input)),
    rename: input => call(namespace => namespace.renameLogin(input)),
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'subscription-logins',
    order: 11,
    label: 'Logins',
    inject: injected,
  }, OAuthSection))
}

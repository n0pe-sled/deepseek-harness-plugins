import { useCallback, useEffect, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ActionOutcome,
  AccountInput,
  AnswerInput,
  AuthNotice,
  AuthPoll,
  AuthStatus,
  BeginInput,
  ProviderId,
  ProviderInput,
  RenameInput,
  RemoteCallOutcome,
} from '../shared/remote.ts'

export interface OAuthSectionInjected {
  status(input: ProviderInput): Promise<RemoteCallOutcome<AuthStatus>>
  begin(input: BeginInput): Promise<RemoteCallOutcome<ActionOutcome>>
  poll(input: ProviderInput): Promise<RemoteCallOutcome<AuthPoll>>
  answer(input: AnswerInput): Promise<RemoteCallOutcome<ActionOutcome>>
  cancel(input: ProviderInput): Promise<RemoteCallOutcome<ActionOutcome>>
  activate(input: AccountInput): Promise<RemoteCallOutcome<ActionOutcome>>
  remove(input: AccountInput): Promise<RemoteCallOutcome<ActionOutcome>>
  rename(input: RenameInput): Promise<RemoteCallOutcome<ActionOutcome>>
}

export type OAuthSectionProps = PropsRuntime<'settings.section'> & InjectFace<OAuthSectionInjected>

const styles = {
  root: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px 20px', maxWidth: '720px' } as const,
  card: {
    display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '10px',
    border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-0)',
  } as const,
  heading: { margin: 0, color: 'var(--dsw-alias-label-primary)', fontSize: '16px', fontWeight: 600 } as const,
  copy: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: '13px', lineHeight: 1.5 } as const,
  status: { margin: 0, color: 'var(--dsw-alias-label-primary)', fontSize: '13px', fontWeight: 600 } as const,
  error: { margin: 0, color: 'var(--dsw-alias-state-error-primary)', fontSize: '13px', lineHeight: 1.45 } as const,
  actions: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' } as const,
  accountList: { display: 'flex', flexDirection: 'column', gap: '8px' } as const,
  account: {
    display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '10px', alignItems: 'center',
    padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l1)',
    background: 'var(--dsw-alias-bg-layer-1)',
  } as const,
  accountName: { color: 'var(--dsw-alias-label-primary)', fontSize: '13px', fontWeight: 600 } as const,
  badge: {
    padding: '2px 7px', borderRadius: '999px', fontSize: '11px',
    color: 'var(--dsw-alias-brand-text)', background: 'var(--dsw-alias-bg-layer-2)',
  } as const,
  primary: {
    border: 0, borderRadius: '7px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px',
    background: 'var(--dsw-alias-button-primary-fill)', color: 'var(--dsw-alias-label-primary-foreground)',
  } as const,
  button: {
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '7px', padding: '8px 14px', cursor: 'pointer',
    fontSize: '13px', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)',
  } as const,
  danger: {
    border: '1px solid var(--dsw-alias-state-error-primary)', borderRadius: '7px', padding: '8px 14px', cursor: 'pointer',
    fontSize: '13px', background: 'transparent', color: 'var(--dsw-alias-state-error-primary)',
  } as const,
  disabled: { opacity: 0.45, cursor: 'not-allowed' } as const,
  notice: {
    display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '8px',
    background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)',
  } as const,
  code: {
    alignSelf: 'flex-start', padding: '8px 12px', borderRadius: '7px', fontFamily: 'ui-monospace, monospace',
    fontSize: '20px', letterSpacing: '0.08em', color: 'var(--dsw-alias-label-primary)',
    background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l2)',
  } as const,
  link: { color: 'var(--dsw-alias-brand-text)', fontSize: '13px' } as const,
  input: {
    padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', fontSize: '13px',
  } as const,
}

function Notice({ notice }: { notice: AuthNotice }) {
  const copyCode = (): void => { if (notice.code !== undefined) void navigator.clipboard?.writeText(notice.code) }
  return (
    <div style={styles.notice}>
      <p style={styles.copy}>{notice.message}</p>
      {notice.url === undefined ? null : <a style={styles.link} href={notice.url} target="_blank" rel="noreferrer">Open sign-in page</a>}
      {notice.code === undefined ? null : <button type="button" style={styles.code} onClick={copyCode} title="Copy code">{notice.code}</button>}
    </div>
  )
}

function ProviderLoginCard(props: OAuthSectionProps & { provider: ProviderId }) {
  const isAnthropic = props.provider === 'anthropic'
  const isZai = props.provider === 'zai'
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [polling, setPolling] = useState(false)
  const [notices, setNotices] = useState<AuthNotice[]>([])
  const [prompt, setPrompt] = useState<AuthPoll['prompt']>(null)
  const [answer, setAnswer] = useState('')
  const [accountName, setAccountName] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settlement, setSettlement] = useState<AuthPoll['settlement']>(null)

  const refresh = useCallback(async () => {
    const result = await props.status({ provider: props.provider })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setStatus(result.value)
    if (result.value.inFlight) setPolling(true)
  }, [props.provider, props.status])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (!polling) return
    let disposed = false
    let timer: number | undefined
    const tick = async (): Promise<void> => {
      const result = await props.poll({ provider: props.provider })
      if (disposed) return
      if (!result.ok) {
        setError(result.error)
        setPolling(false)
        return
      }
      if (result.value.notices.length > 0) setNotices(current => [...current, ...result.value.notices])
      setPrompt(result.value.prompt)
      if (result.value.settlement !== null) {
        setSettlement(result.value.settlement)
        setError(result.value.settlement === 'failed' ? result.value.message ?? 'Sign-in failed.' : null)
        setPolling(false)
        void refresh()
        return
      }
      timer = window.setTimeout(() => { void tick() }, 750)
    }
    void tick()
    return () => {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [polling, props.poll, props.provider, refresh])

  const begin = async (): Promise<void> => {
    const label = accountName.trim()
    if (label === '') {
      setError('Enter a name for this login, such as Work or Personal.')
      return
    }
    setBusy(true)
    setError(null)
    setSettlement(null)
    setNotices([])
    setPrompt(null)
    const result = await props.begin({ provider: props.provider, label })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (!result.value.ok) {
      setError(result.value.error)
      return
    }
    setAccountName('')
    setPolling(true)
  }

  const submit = async (value: string): Promise<void> => {
    if (prompt === null) return
    setBusy(true)
    const result = await props.answer({ provider: props.provider, promptId: prompt.id, value })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (!result.value.ok) {
      setError(result.value.error)
      return
    }
    setPrompt(null)
    setAnswer('')
  }

  const cancel = async (): Promise<void> => {
    setBusy(true)
    const result = await props.cancel({ provider: props.provider })
    setBusy(false)
    if (!result.ok) setError(result.error)
    else if (!result.value.ok) setError(result.value.error)
  }

  const runAccountAction = async (
    action: () => Promise<RemoteCallOutcome<ActionOutcome>>,
  ): Promise<boolean> => {
    setBusy(true)
    setError(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return false
    }
    if (!result.value.ok) {
      setError(result.value.error)
      return false
    }
    setSettlement(null)
    setNotices([])
    await refresh()
    return true
  }

  const activate = (accountId: string): Promise<boolean> => runAccountAction(
    () => props.activate({ provider: props.provider, accountId }),
  )

  const remove = async (accountId: string, label: string): Promise<void> => {
    if (!window.confirm(`Remove the saved login "${label}"? This deletes its stored provider credential.`)) return
    await runAccountAction(() => props.remove({ provider: props.provider, accountId }))
  }

  const rename = async (): Promise<void> => {
    if (renaming === null) return
    const label = renaming.label.trim()
    if (label === '') {
      setError('A login name cannot be empty.')
      return
    }
    if (await runAccountAction(() => props.rename({ provider: props.provider, accountId: renaming.id, label }))) {
      setRenaming(null)
    }
  }

  const disabled = busy || status === null
  return (
    <div style={styles.card}>
      <h2 style={styles.heading}>{isZai ? 'Z.AI Coding Plan' : isAnthropic ? 'Claude account' : 'ChatGPT subscription'}</h2>
      <p style={styles.copy}>{isZai
        ? <>Add the API key from your Z.AI account to use the <code>zai</code> provider with the GLM Coding Plan endpoint.</>
        : isAnthropic
          ? <>Authorize the <code>anthropic</code> provider through Claude's browser OAuth flow. Claude may ask you to paste a callback URL or authorization code back here.</>
          : <>Authorize the <code>openai-codex</code> provider with your ChatGPT subscription. This uses OpenAI's browser or device-code flow.</>}</p>
      {isAnthropic ? <p style={styles.copy}>Anthropic says third-party tools should normally use API keys. OAuth access may be unavailable or charged against usage credits.</p> : null}
      {isZai ? <p style={styles.copy}>Z.AI uses API key authentication rather than browser OAuth. Create a key in the Z.AI API Keys page after subscribing.</p> : null}
      {isZai ? <p style={styles.copy}>Z.AI limits Coding Plan benefits to supported tools. Confirm that your use of DSH complies with the current plan terms.</p> : null}
        {status === null ? <p style={styles.status}>Checking sign-in status...</p> : (
          <>
            <p style={styles.status}>{status.configured
              ? `Active: ${status.accounts.find(account => account.active)?.label ?? status.label}`
              : `No active ${status.label} login`}</p>
            {!status.available ? <p style={styles.error}>The installed llm-pi-ai package did not register the <code>{props.provider}</code> credential flow.</p> : null}
            {status.accounts.length === 0 ? <p style={styles.copy}>No saved logins yet.</p> : (
              <div style={styles.accountList}>
                {status.accounts.map(account => (
                  <div style={styles.account} key={account.id}>
                    {renaming?.id === account.id ? (
                      <form style={styles.actions} onSubmit={(event) => { event.preventDefault(); void rename() }}>
                        <input style={styles.input} maxLength={40} value={renaming.label} onChange={event => { setRenaming({ id: account.id, label: event.target.value }) }} autoFocus />
                        <button type="submit" style={styles.primary} disabled={busy}>Save</button>
                        <button type="button" style={styles.button} disabled={busy} onClick={() => { setRenaming(null) }}>Cancel</button>
                      </form>
                    ) : (
                      <div style={styles.actions}>
                        <span style={styles.accountName}>{account.label}</span>
                        {account.active ? <span style={styles.badge}>Active</span> : null}
                      </div>
                    )}
                    {renaming?.id === account.id ? null : (
                      <div style={styles.actions}>
                        {!account.active ? <button type="button" style={styles.button} disabled={busy || polling} onClick={() => { void activate(account.id) }}>Use</button> : null}
                        <button type="button" style={styles.button} disabled={busy || polling} onClick={() => { setRenaming({ id: account.id, label: account.label }) }}>Rename</button>
                        <button type="button" style={styles.danger} disabled={busy || polling} onClick={() => { void remove(account.id, account.label) }}>Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <form style={styles.actions} onSubmit={(event) => { event.preventDefault(); void begin() }}>
              <input style={styles.input} maxLength={40} placeholder="Login name, e.g. Work" value={accountName} onChange={event => { setAccountName(event.target.value) }} disabled={busy || polling || !status.available} />
              <button type="submit" style={{ ...styles.primary, ...((disabled || !status.available || polling || accountName.trim() === '') ? styles.disabled : {}) }} disabled={disabled || !status.available || polling || accountName.trim() === ''}>Add login</button>
              {polling ? <button type="button" style={{ ...styles.button, ...(busy ? styles.disabled : {}) }} disabled={busy} onClick={() => { void cancel() }}>Cancel sign-in</button> : null}
            </form>
            <p style={styles.copy}>Adding a login opens {status.methodLabel}. Switching changes the account used by the next model request.</p>
            {status.configured ? <p style={styles.copy}>The <code>{props.provider}</code> model provider is added automatically after sign-in. Choose one of its models for a session.</p> : null}
          </>
        )}
        {notices.map((notice, index) => <Notice key={`${index}-${notice.message}`} notice={notice} />)}
        {prompt === null ? null : (
          <div style={styles.notice}>
            <p style={styles.status}>{prompt.prompt.message}</p>
            {prompt.prompt.kind === 'select' ? (
              <div style={styles.actions}>
                {prompt.prompt.options.map(option => (
                  <button type="button" style={styles.button} key={option.id} disabled={busy} onClick={() => { void submit(option.id) }} title={option.description}>{option.label}</button>
                ))}
              </div>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); void submit(answer) }} style={styles.actions}>
                <input style={styles.input} type={prompt.prompt.kind === 'secret' ? 'password' : 'text'} placeholder={prompt.prompt.placeholder} value={answer} onChange={event => { setAnswer(event.target.value) }} autoFocus />
                <button type="submit" style={styles.primary} disabled={busy || answer === ''}>Continue</button>
              </form>
            )}
          </div>
        )}
        {settlement === 'authorized' ? <p style={styles.status}>Login saved and selected for <code>{props.provider}</code>.</p> : null}
        {settlement === 'cancelled' ? <p style={styles.copy}>Sign-in cancelled.</p> : null}
        {error === null ? null : <p style={styles.error}>{error}</p>}
    </div>
  )
}

export function OAuthSection(props: OAuthSectionProps) {
  return (
    <div style={styles.root}>
      <h2 style={styles.heading}>Subscription logins</h2>
      <p style={styles.copy}>Save named provider accounts and choose which one DSH uses. Tokens and API keys stay in DSH's credential store.</p>
      <ProviderLoginCard {...props} provider="openai-codex" />
      <ProviderLoginCard {...props} provider="anthropic" />
      <ProviderLoginCard {...props} provider="zai" />
    </div>
  )
}

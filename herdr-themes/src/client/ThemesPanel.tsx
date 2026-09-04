/**
 * The Themes settings page: every herdr built-in theme plus the system option,
 * each as a card with live color swatches. A card click applies the theme
 * immediately (that is the preview); the card's action row then offers “Use”
 * to persist the selection in the Host settings document and “Cancel” to
 * revert to the saved one.
 *
 * Everything arrives through the props shares (AGENTS.md): the selection
 * scope and the theme snapshot through the injected selector hooks, the
 * write paths through the injected actions. The component never sees ctx.
 */

import { useState } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable, InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import { HERDR_THEMES } from '../shared/themes.ts'

/** The settings this plugin stores (mirrors the host schema). */
export interface ThemeSelection {
  themeId?: string
}

/** What a “Use” attempt settled as, decided by the Host read-back. */
export type ThemeApplyOutcome =
  | { status: 'saved' }
  /** The write settled but the section does not hold the value (host-side refusal / conflict). */
  | { status: 'not-applied' }
  /** The write path itself failed. */
  | { status: 'error'; message: string }
  /** Remote browser: selection applies for this session only, nothing persists. */
  | { status: 'session-only' }

/** The registration-side face the settings.section entry injects. */
export interface ThemesPanelInjected {
  hooks: {
    /** Bound settings scope for the plugin namespace; renderer binds it as useSelection. */
    selection: SettingsScope<ThemeSelection>
    /** ThemeRuntime snapshot source; renderer binds it as useTheme. */
    theme: HostObservable<ThemeSnapshot>
  }
  actions: {
    /** Apply a theme id live without persisting (the “preview” step). */
    preview: (id: 'system' | string) => void
    /** Persist a theme id (or `system`) and verify it landed. */
    apply: (id: 'system' | string) => Promise<ThemeApplyOutcome>
    /** Revert the current live theme to the persisted selection. */
    cancel: () => void
  }
}

/** Full component props: section owner share + inject face. */
export type ThemesPanelProps =
  PropsRuntime<'settings.section'> & InjectFace<ThemesPanelInjected>

interface SwatchPalette {
  panelBg: string
  surface1: string
  accent: string
  text: string
  red: string
  green: string
  yellow: string
}

const swatchColors = (palette: SwatchPalette): string[] => [
  palette.panelBg,
  palette.surface1,
  palette.accent,
  palette.text,
  palette.red,
  palette.green,
  palette.yellow,
]

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px 20px',
    maxWidth: '880px',
  } as const,
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--dsw-alias-label-primary)',
  } as const,
  hint: {
    margin: 0,
    fontSize: '12.5px',
    color: 'var(--dsw-alias-label-tertiary)',
  } as const,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: '10px',
  } as const,
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    background: 'var(--dsw-alias-bg-layer-1)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '10px',
    cursor: 'pointer',
  } as const,
  cardActive: {
    borderColor: 'var(--dsw-alias-brand-primary)',
    boxShadow: '0 0 0 1px var(--dsw-alias-brand-primary)',
  } as const,
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  } as const,
  name: {
    margin: 0,
    fontSize: '13.5px',
    fontWeight: 600,
    color: 'var(--dsw-alias-label-primary)',
  } as const,
  badge: {
    fontSize: '10.5px',
    padding: '2px 7px',
    borderRadius: '999px',
    whiteSpace: 'nowrap' as const,
    background: 'var(--dsw-alias-bg-layer-2)',
    color: 'var(--dsw-alias-label-secondary)',
  } as const,
  badgeActive: {
    background: 'var(--dsw-alias-button-primary-fill)',
    color: 'var(--dsw-alias-label-primary-foreground)',
  } as const,
  swatches: {
    display: 'flex',
    gap: '4px',
  } as const,
  swatch: {
    width: '22px',
    height: '16px',
    borderRadius: '4px',
    border: '1px solid var(--dsw-alias-border-l2)',
    boxSizing: 'border-box' as const,
  } as const,
  description: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--dsw-alias-label-secondary)',
    minHeight: '30px',
  } as const,
  actions: {
    display: 'flex',
    gap: '6px',
  } as const,
  button: {
    flex: 1,
    padding: '5px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-2)',
    color: 'var(--dsw-alias-label-primary)',
    cursor: 'pointer',
  } as const,
  primaryButton: {
    flex: 1,
    padding: '5px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--dsw-alias-button-primary-fill)',
    color: 'var(--dsw-alias-label-primary-foreground)',
    cursor: 'pointer',
  } as const,
  note: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--dsw-alias-state-warn-primary)',
  } as const,
  sectionLabel: {
    margin: '10px 0 2px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--dsw-alias-label-secondary)',
  } as const,
}

interface CardProps {
  id: string
  name: string
  description: string
  scheme: 'dark' | 'light'
  swatches: string[]
  badge: string
  previewing: boolean
  actions: ThemesPanelInjected['actions']
  onPreview: () => void
  onSettled: (outcome: ThemeApplyOutcome) => void
}

/** One theme card. A click previews; the action row saves or cancels. */
function ThemeCard(props: CardProps) {
  const [busy, setBusy] = useState(false)
  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      props.onSettled(await props.actions.apply(props.id))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      style={props.previewing ? { ...styles.card, ...styles.cardActive } : styles.card}
      onClick={() => { if (!props.previewing) { props.actions.preview(props.id); props.onPreview() } }}
      role="button"
      aria-pressed={props.previewing}
      tabIndex={0}
      onKeyDown={(event) => {
        if (!props.previewing && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          props.actions.preview(props.id)
          props.onPreview()
        }
      }}
    >
      <div style={styles.cardHeader}>
        <p style={styles.name}>{props.name}</p>
        <span style={props.badge === 'Active' ? { ...styles.badge, ...styles.badgeActive } : styles.badge}>
          {props.badge}
        </span>
      </div>
      <div style={styles.swatches}>
        {props.swatches.map(color => (
          <span key={color} style={{ ...styles.swatch, background: color }} />
        ))}
      </div>
      <p style={styles.description}>
        {props.description}{props.scheme === 'dark' ? ' · dark' : ' · light'}
      </p>
      {props.previewing && (
        <div style={styles.actions} onClick={(event) => { event.stopPropagation() }}>
          <button type="button" style={styles.primaryButton} disabled={busy} onClick={() => { void save() }}>
            {busy ? 'Saving…' : 'Use theme'}
          </button>
          <button type="button" style={styles.button} disabled={busy} onClick={() => {
            props.actions.cancel()
            props.onSettled({ status: 'saved' })
          }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Render the Themes settings page.
 * @param props - section owner share plus the injected theme face.
 * @returns the page.
 */
export function ThemesPanel(props: ThemesPanelProps) {
  const selection = props.useSelection(s => s)
  const theme = props.useTheme(s => s)
  const stored = typeof selection.value?.themeId === 'string' ? selection.value.themeId : ''
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const settled = (outcome: ThemeApplyOutcome): void => {
    if (outcome.status === 'saved') {
      setNote(null)
      setPreviewId(null)
      return
    }
    if (outcome.status === 'session-only') {
      setNote('Applied for this session only — remote browsers cannot save a theme choice.')
      setPreviewId(null)
      return
    }
    if (outcome.status === 'not-applied') {
      setNote('The host did not accept the change; your previous selection stays.')
      return
    }
    setNote(`Could not save: ${outcome.message}`)
  }

  const currentId = theme.preference
  const systemPreviewing = previewId === 'system'

  return (
    <div style={styles.root}>
      <p style={styles.title}>Themes from Herdr</p>
      <p style={styles.hint}>
        Click a theme to preview it live. Use it to save. The saved theme re-applies on every reload
        and stays until you switch here. The Appearance row only affects the base palette when no
        theme is saved.
      </p>

      <p style={styles.sectionLabel}>System</p>
      <div
        style={systemPreviewing ? { ...styles.card, ...styles.cardActive } : styles.card}
        role="button"
        aria-pressed={systemPreviewing}
        tabIndex={0}
        onClick={() => { if (!systemPreviewing) { props.actions.preview('system'); setPreviewId('system') } }}
        onKeyDown={(event) => {
          if (!systemPreviewing && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            props.actions.preview('system')
            setPreviewId('system')
          }
        }}
      >
        <div style={styles.cardHeader}>
          <p style={styles.name}>Follow the OS</p>
          <span style={stored === '' && !systemPreviewing ? { ...styles.badge, ...styles.badgeActive } : styles.badge}>
            {stored === '' && !systemPreviewing ? 'Active' : 'system'}
          </span>
        </div>
        <p style={styles.description}>
          Default DSH behavior: light or dark follows your operating system, no overrides.
        </p>
        {systemPreviewing && (
          <div style={styles.actions} onClick={(event) => { event.stopPropagation() }}>
            <button type="button" style={styles.primaryButton} onClick={() => { void props.actions.apply('system').then(settled) }}>
              Use system
            </button>
            <button type="button" style={styles.button} onClick={() => {
              props.actions.cancel()
              setPreviewId(null)
            }}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <p style={styles.sectionLabel}>Herdr built-in themes</p>
      <div style={styles.grid}>
        {HERDR_THEMES.map(def => {
          const isPreviewing = previewId === def.id
          const badge = isPreviewing
            ? 'Preview'
            : stored === def.id || currentId === def.id
              ? 'Active'
              : def.colorScheme
          return (
            <ThemeCard
              key={def.id}
              id={def.id}
              name={def.name}
              description={def.description}
              scheme={def.colorScheme}
              swatches={swatchColors(def.palette)}
              badge={badge}
              previewing={isPreviewing}
              actions={props.actions}
              onPreview={() => setPreviewId(def.id)}
              onSettled={settled}
            />
          )
        })}
      </div>
      {note !== null && <p style={styles.note}>{note}</p>}
    </div>
  )
}

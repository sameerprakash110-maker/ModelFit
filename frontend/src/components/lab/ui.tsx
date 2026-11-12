import { AlertTriangle, Check, CircleDashed, FlaskConical, LoaderCircle, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { BenchmarkStatus } from '../../services/api.ts'
import { ROLE_LABEL } from '../../utils/benchmark.ts'
import type { Role } from '../../utils/benchmark.ts'

/* ---------- status ---------- */

const STATUS: Record<BenchmarkStatus, { label: string; icon: ReactNode }> = {
  pending: { label: 'Not run yet', icon: <CircleDashed aria-hidden="true" /> },
  running: { label: 'Running', icon: <LoaderCircle aria-hidden="true" className="spin" /> },
  completed: { label: 'Completed', icon: <Check aria-hidden="true" /> },
  failed: { label: 'Failed', icon: <X aria-hidden="true" /> },
}

/** Run state as icon + words, so it never relies on colour. */
export function StatusChip({ status }: { status: BenchmarkStatus }) {
  const { label, icon } = STATUS[status] ?? STATUS.pending
  return (
    <span className={`chip chip--${status}`}>
      {icon}
      {label}
    </span>
  )
}

/** Marks anything that came from a simulated run, wherever it appears. */
export function SimulatedTag({ long = false }: { long?: boolean }) {
  return (
    <span className="chip chip--sim" title="Simulated run: no real model was called. Numbers are placeholders.">
      <FlaskConical aria-hidden="true" />
      {long ? 'Simulated, not real results' : 'Simulated'}
    </span>
  )
}

/* ---------- feedback ---------- */

/** An error that says what happened and what to do. */
export function ErrorNote({
  children,
  onRetry,
  retryLabel = 'Try again',
}: {
  children: ReactNode
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className="note note--error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div className="note-body">{children}</div>
      {onRetry && (
        <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="loading" role="status">
      <LoaderCircle aria-hidden="true" className="spin" />
      {label}
    </p>
  )
}

/** An empty area that invites the next action. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

/* ---------- navigation ---------- */

export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <ol>
        {items.map((item, index) => (
          <li key={index}>
            {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/* ---------- model roles (shared by every chart) ---------- */

/**
 * The mark for a model's role. Shape backs up colour: recommended is a filled dot,
 * used today is a ring, others are a small grey dot. A model that is both gets a filled dot with a ring.
 */
export function RoleMark({ role, isBaseline = false }: { role: Role; isBaseline?: boolean }) {
  const both = role === 'recommended' && isBaseline
  return <span className={`role-mark role-mark--${role}${both ? ' role-mark--both' : ''}`} aria-hidden="true" />
}

export function RoleLegend({ roles }: { roles: Role[] }) {
  const unique = (['recommended', 'baseline', 'other'] as Role[]).filter((r) => roles.includes(r))
  if (unique.length < 2) return null
  return (
    <ul className="legend" aria-label="Legend">
      {unique.map((role) => (
        <li key={role}>
          <RoleMark role={role} />
          {ROLE_LABEL[role]}
        </li>
      ))}
    </ul>
  )
}

/** Model name with its role mark and short role text, for tables and lists. */
export function ModelName({
  name,
  role,
  isBaseline,
  provider,
}: {
  name: string
  role: Role
  isBaseline: boolean
  provider?: string
}) {
  const tags: string[] = []
  if (role === 'recommended') tags.push('recommended')
  if (isBaseline) tags.push('used today')
  return (
    <span className="model">
      <RoleMark role={role} isBaseline={isBaseline} />
      <span className="model-text">
        <span className="model-name">{name}</span>
        {(provider || tags.length > 0) && (
          <span className="model-sub">
            {provider}
            {tags.length > 0 && <span className="model-tags">{tags.join(', ')}</span>}
          </span>
        )}
      </span>
    </span>
  )
}

/* ---------- stepper ---------- */

/** Vertical steps for a real sequence. Done steps collapse to a summary with a Change button. */
export function Step({
  number,
  title,
  state,
  summary,
  onEdit,
  children,
}: {
  number: number
  title: string
  state: 'done' | 'current' | 'upcoming'
  summary?: ReactNode
  onEdit?: () => void
  children?: ReactNode
}) {
  return (
    <section className={`wiz-step wiz-step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
      <div className="wiz-rail" aria-hidden="true">
        <span className="wiz-num">{state === 'done' ? <Check /> : number}</span>
      </div>
      <div className="wiz-main">
        <div className="wiz-head">
          <h2 className="wiz-title">
            <span className="visually-hidden">Step {number}: </span>
            {title}
          </h2>
          {state === 'done' && onEdit && (
            <button type="button" className="btn-text" onClick={onEdit}>
              Change<span className="visually-hidden"> {title.toLowerCase()}</span>
            </button>
          )}
        </div>
        {state === 'done' && summary && <div className="wiz-summary">{summary}</div>}
        {state === 'current' && <div className="wiz-body">{children}</div>}
      </div>
    </section>
  )
}

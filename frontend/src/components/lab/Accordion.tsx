import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * One collapsible section of the detailed analysis. The heading row always shows
 * a short summary, so a closed section still says what is inside. Content mounts
 * the first time the section opens (so closed sections cost no requests) and
 * stays mounted afterwards, keeping filters and scroll positions.
 */
export function AccordionSection({
  id,
  title,
  summary,
  badge,
  open,
  onToggle,
  level = 2,
  children,
}: {
  /** Used for the anchor (#id) and the ARIA wiring. */
  id: string
  /** Heading level of the section title, to fit the page outline. */
  level?: 2 | 3
  title: string
  /** One short line shown beside the title, open or closed. */
  summary?: ReactNode
  /** Something that must stay visible while closed, such as a verdict or a status. */
  badge?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const Heading = level === 3 ? 'h3' : 'h2'

  return (
    <section id={id} className={`acc${open ? ' is-open' : ''}`} aria-labelledby={`${id}-button`}>
      <Heading className="acc-heading">
        <button
          type="button"
          id={`${id}-button`}
          className="acc-button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
        >
          <ChevronRight aria-hidden="true" className="acc-chevron" />
          <span className="acc-title">{title}</span>
          {summary && <span className="acc-summary">{summary}</span>}
          {badge && <span className="acc-badge">{badge}</span>}
        </button>
      </Heading>
      <div id={`${id}-panel`} className="acc-panel" hidden={!open}>
        {mounted && children}
      </div>
    </section>
  )
}

/** A smaller fold inside a section, for a metric group, one record or supporting evidence. */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  className = '',
  children,
}: {
  title: ReactNode
  summary?: ReactNode
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [mounted, setMounted] = useState(defaultOpen)
  if (open && !mounted) setMounted(true)

  return (
    <div className={`fold${open ? ' is-open' : ''} ${className}`}>
      <button
        type="button"
        className="fold-button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronRight aria-hidden="true" className="fold-chevron" />
        <span className="fold-title">{title}</span>
        {summary && <span className="fold-summary">{summary}</span>}
      </button>
      <div id={`${id}-panel`} className="fold-panel" hidden={!open}>
        {mounted && children}
      </div>
    </div>
  )
}

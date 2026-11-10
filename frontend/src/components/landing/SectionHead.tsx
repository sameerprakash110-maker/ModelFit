import type { ReactNode } from 'react'

interface SectionHeadProps {
  title: string
  children?: ReactNode
}

/**
 * Heading block that opens every section. The stitched rule under it is
 * drawn in when the section scrolls into view (see useReveal).
 */
export function SectionHead({ title, children }: SectionHeadProps) {
  return (
    <div className="section-head" data-reveal>
      <h2 className="h2">{title}</h2>
      {children && <p className="lede">{children}</p>}
      <span className="stitch-rule" aria-hidden="true" />
    </div>
  )
}

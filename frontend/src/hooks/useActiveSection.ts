import { useEffect, useState } from 'react'

/** Returns the id of the section currently crossing the middle of the viewport, if any. */
export function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(',')

  useEffect(() => {
    const elements = key
      .split(',')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (!elements.length) return

    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        // If two sections straddle the line, the later one in the page wins.
        const current = elements.filter((el) => visible.has(el.id)).pop()
        setActive(current ? current.id : null)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [key])

  return active
}

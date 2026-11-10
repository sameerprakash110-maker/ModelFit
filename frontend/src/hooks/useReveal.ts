import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Marks every [data-reveal] element inside `root` with "is-in" the first time
 * it scrolls into view. The hidden starting state only applies once this has
 * run (the root gets "reveal-on"), so without JavaScript, or with reduced
 * motion, everything is simply visible.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el || !('IntersectionObserver' in window)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    el.classList.add('reveal-on')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    el.querySelectorAll('[data-reveal]').forEach((target) => observer.observe(target))

    return () => {
      observer.disconnect()
      el.classList.remove('reveal-on')
    }
  }, [root])
}

import { useEffect, useRef, useState } from 'react'

/** Width of an element, kept current as it resizes. Charts draw to this width. */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth || fallback)
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.width)
      if (next > 0) setWidth(next)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fallback])
  return { ref, width }
}

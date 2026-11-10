import { useEffect, useRef } from 'react'
import { TapeStrip } from './TapeStrip.tsx'

const REST_OFFSET = -180
const PULL_PER_SCROLLED_PX = 0.55

/** The tape across the bottom of the hero. Scrolling pulls it through. */
export function ScrollTape() {
  const inner = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const update = () => {
      frame = 0
      if (!inner.current) return
      const x = REST_OFFSET - window.scrollY * PULL_PER_SCROLLED_PX
      inner.current.style.transform = `translate3d(${x}px, 0, 0)`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="scroll-tape" aria-hidden="true">
      <div ref={inner} className="scroll-tape-inner" style={{ transform: `translate3d(${REST_OFFSET}px, 0, 0)` }}>
        <TapeStrip units={420} ppu={12} />
      </div>
    </div>
  )
}

'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'

/* ------------------------------------------------------------------
   One shared, position-based watcher for every reveal on the page.

   An IntersectionObserver only fires when an element *crosses* a
   threshold, so a jump that skips an element entirely — the End key, a
   deep link, restored scroll position — never fires and would leave
   that content stuck at opacity 0. Checking positions instead cannot
   miss anything: whatever sits at or above the trigger line is shown,
   however the reader got there.

   The listener attaches with the first pending element and detaches
   itself once the last one has been revealed, so a fully revealed page
   costs nothing.
   ------------------------------------------------------------------ */

type Pending = { el: Element; show: () => void }

const pending = new Set<Pending>()
let frame = 0
let listening = false

function sweep() {
  frame = 0
  const line = window.innerHeight * 0.92

  for (const entry of pending) {
    if (entry.el.getBoundingClientRect().top < line) {
      entry.show()
      pending.delete(entry)
    }
  }

  if (pending.size === 0) stopListening()
}

function schedule() {
  if (frame) return
  frame = requestAnimationFrame(sweep)
}

function startListening() {
  if (listening) return
  listening = true
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
}

function stopListening() {
  if (!listening) return
  listening = false
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
}

function watch(el: Element, show: () => void) {
  const entry: Pending = { el, show }
  pending.add(entry)
  startListening()
  schedule()

  return () => {
    pending.delete(entry)
    if (pending.size === 0) stopListening()
  }
}

type Props = {
  children: ReactNode
  /** Stagger position — multiplied by 60ms, the design system's stagger step. */
  index?: number
  as?: ElementType
  className?: string
  id?: string
  style?: CSSProperties
}

export function Reveal({ children, index = 0, as, className, id, style }: Props) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Readers who asked for less motion get the finished state right away.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    return watch(el, () => setVisible(true))
  }, [])

  return (
    <Tag
      ref={ref}
      id={id}
      className={['reveal', className].filter(Boolean).join(' ')}
      data-visible={visible ? 'true' : 'false'}
      style={
        {
          ...style,
          '--reveal-delay': `${Math.min(index, 8) * 60}ms`,
        } as CSSProperties
      }
    >
      {children}
    </Tag>
  )
}

/**
 * useStickyState Hook
 *
 * Detects when a sticky element gets pinned using IntersectionObserver.
 * Based on the technique from https://css-tricks.com/how-to-detect-when-a-sticky-element-gets-pinned/
 */

import { useState, useEffect, RefObject } from 'react'

export function useStickyState<T extends HTMLElement>(
  targetRef: RefObject<T>
): { isSticky: boolean } {
  const [isSticky, setIsSticky] = useState(false)

  useEffect(() => {
    if (!targetRef.current) return

    // Create sentinel element that sits just above the sticky element
    const sentinel = document.createElement('div')
    sentinel.style.position = 'absolute'
    sentinel.style.top = '-1px'
    sentinel.style.height = '1px'
    sentinel.style.width = '100%'
    sentinel.style.pointerEvents = 'none'
    sentinel.style.visibility = 'hidden'

    // Insert sentinel before the sticky element
    const target = targetRef.current
    target.parentNode?.insertBefore(sentinel, target)

    // Create intersection observer to watch the sentinel
    const observer = new IntersectionObserver(
      ([entry]) => {
        // When sentinel is not intersecting (out of view), element is sticky
        setIsSticky(!entry.isIntersecting)
      },
      {
        threshold: 0,
        rootMargin: '0px 0px 0px 0px',
      }
    )

    observer.observe(sentinel)

    // Cleanup
    return () => {
      observer.disconnect()
      if (sentinel.parentNode) {
        sentinel.parentNode.removeChild(sentinel)
      }
    }
  }, [targetRef])

  return { isSticky }
}

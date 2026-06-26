import { useState, useEffect } from 'react'

// Single source of truth for the phone breakpoint. Keep in sync with the
// `--mobile` media queries in the CSS (max-width: 640px).
export const MOBILE_MAX_WIDTH = 640

export function useIsMobile() {
  const query = `(max-width: ${MOBILE_MAX_WIDTH}px)`
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = e => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return isMobile
}

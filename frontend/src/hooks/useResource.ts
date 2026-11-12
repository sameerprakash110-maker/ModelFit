import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../services/api.ts'

interface Resource<T> {
  data: T | null
  error: string | null
  loading: boolean
  /** Fetch again. Keeps showing the current data while it loads. */
  reload: () => void
}

/**
 * Loads data for a page. A 401 means the session ended, so it sends the visitor
 * to log in and brings them back afterwards.
 */
export function useResource<T>(load: () => Promise<T>, deps: unknown[]): Resource<T> {
  const navigate = useNavigate()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadRef
      .current()
      .then((value) => {
        if (cancelled) return
        setData(value)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login', { replace: true, state: { from: window.location.pathname } })
          return
        }
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, navigate])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, error, loading, reload }
}

/** Message for a failed action, with the same 401 handling as useResource. */
export function useActionError() {
  const navigate = useNavigate()
  return useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login', { replace: true, state: { from: window.location.pathname } })
        return 'Your session has ended.'
      }
      return err instanceof Error ? err.message : 'Something went wrong.'
    },
    [navigate],
  )
}

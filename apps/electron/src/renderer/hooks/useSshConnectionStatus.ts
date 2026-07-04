import { useEffect, useState } from 'react'
import type { SshConnectionStatus } from '../../shared/types'

/**
 * Tracks the latest SSH-level connection status pushed while (re)connecting an
 * SSH-backed workspace. Composed IN FRONT of the ws transport state so the UI
 * can show "SSH tunnel reconnecting…" / "Starting remote server…" instead of a
 * raw ws error ("connection refused on 127.0.0.1:<dead port>").
 *
 * Returns the status for `hostId`, or null when none is active / the workspace
 * is plain-ws (hostId undefined).
 */
export function useSshConnectionStatus(hostId: string | null | undefined): SshConnectionStatus | null {
  const [status, setStatus] = useState<SshConnectionStatus | null>(null)

  useEffect(() => {
    if (!hostId) {
      setStatus(null)
      return
    }
    setStatus(null)
    const unsub = window.electronAPI.onSshConnectionStatus?.((s) => {
      if (s.hostId === hostId) setStatus(s)
    })
    return () => unsub?.()
  }, [hostId])

  return status
}

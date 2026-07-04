/**
 * Allocate a free local TCP port on 127.0.0.1 by binding an ephemeral server
 * and reading back the assigned port. There is an inherent TOCTOU window
 * between release and reuse, but ssh's ExitOnForwardFailure surfaces a bind
 * clash as a clean tunnel error which the manager retries.
 */

import { createServer } from 'net'

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('Failed to allocate a local port')))
      }
    })
  })
}

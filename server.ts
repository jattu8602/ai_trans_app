/**
 * Custom Next.js server with Socket.io integration
 * This file is compiled by TypeScript and run with ts-node or tsx
 */

// Load environment variables FIRST - before any other imports
// This must be at the very top to ensure env vars are available when modules load
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

// Load .env.local first (Next.js convention), then .env
const envLocalPath = resolve(process.cwd(), '.env.local')
const envPath = resolve(process.cwd(), '.env')

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath })
  console.log('[server] Loaded .env.local')
}
if (existsSync(envPath)) {
  config({ path: envPath })
  console.log('[server] Loaded .env')
}

// Now import other modules (they can safely use process.env)
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initializeSocketIO } from './server/socket'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '', true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.io
  initializeSocketIO(httpServer)

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> Socket.io available at http://${hostname}:${port}/api/socket`)
    })
})


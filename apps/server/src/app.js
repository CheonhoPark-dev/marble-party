import express from 'express'
import routes from './http/routes.js'

export function createApp() {
  const app = express()

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Host-Key')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204)
    }
    return next()
  })

  app.use(express.json())
  app.get('/health', (_req, res) => res.json({ ok: true }))
  app.use('/api', routes)

  return app
}

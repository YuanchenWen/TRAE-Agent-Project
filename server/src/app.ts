import express, { type Request, type Response } from 'express'
import cors from 'cors'
import allRoutes from './routes'
import { registerIntegrations } from './config/integrations'
import { errorMiddleware, loggerMiddleware } from './middleware'

registerIntegrations()

const app: express.Application = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(loggerMiddleware)

app.get('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'ok',
  })
})

app.use('/api', allRoutes)

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

app.use(errorMiddleware)

export default app

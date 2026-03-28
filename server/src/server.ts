import app from './app'
import { config } from './config'

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`)
})

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`${signal} received, shutting down server`)
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

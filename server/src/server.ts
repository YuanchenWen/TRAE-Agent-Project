import app from './app'
import { config } from './config'
import { imessageAgentBridgeService } from './services'

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`)
})

if (config.imessage.enabled) {
  void imessageAgentBridgeService.start().catch((error) => {
    console.error('Failed to start iMessage agent bridge:', error)
  })
}

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`${signal} received, shutting down server`)
  void imessageAgentBridgeService.stop().finally(() => {
    server.close(() => {
      process.exit(0)
    })
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

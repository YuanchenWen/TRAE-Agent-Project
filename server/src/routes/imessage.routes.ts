import { Router } from 'express'
import { imessageAgentBridgeService } from '../services/imessage-agent-bridge.service'
import { asyncHandler } from '../utils/async-handler'
import { successResponse } from '../utils/response'

const router = Router()

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    successResponse(
      res,
      imessageAgentBridgeService.getStatus(),
      'iMessage bridge status',
    )
  }),
)

export default router

import { Router } from 'express'
import { authMiddleware } from '../middleware'
import { type AuthSession } from '../services/auth.service'
import {
  agentService,
  type AgentLocale,
  type AgentMessage,
  type AgentPendingAction,
} from '../services/agent.service'
import { asyncHandler } from '../utils/async-handler'
import { errorResponse, successResponse } from '../utils/response'

const router = Router()

router.use(authMiddleware)

router.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const body = req.body as {
      message?: unknown
      locale?: unknown
      history?: unknown
      pendingAction?: unknown
    }

    if (typeof body.message !== 'string' || !body.message.trim()) {
      errorResponse(res, '"message" must be a non-empty string.', 400)
      return
    }

    const history = Array.isArray(body.history)
      ? body.history.filter(
          (item): item is AgentMessage =>
            typeof item === 'object' &&
            item !== null &&
            ((item as AgentMessage).role === 'user' ||
              (item as AgentMessage).role === 'assistant') &&
            typeof (item as AgentMessage).content === 'string',
        )
      : undefined

    const pendingAction =
      typeof body.pendingAction === 'object' && body.pendingAction !== null
        ? (body.pendingAction as AgentPendingAction)
        : undefined

    const session = res.locals.auth as AuthSession
    const result = await agentService.handleMessage({
      session,
      message: body.message.trim(),
      locale:
        body.locale === 'en-US' || body.locale === 'zh-CN'
          ? (body.locale as AgentLocale)
          : undefined,
      history,
      pendingAction,
    })

    successResponse(res, result, 'Agent response generated')
  }),
)

export default router

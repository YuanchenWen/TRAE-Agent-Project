import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import { aiService } from '../services/ai.service'
import {
  type ReplyContext,
  type SummarizeOptions,
} from '../types/integration'
import { errorResponse, successResponse } from '../utils/response'

const router = Router()

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>

const asyncHandler =
  (handler: AsyncRouteHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res, next).catch(next)
  }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

router.get(
  '/models',
  asyncHandler(async (_req, res) => {
    const models = await aiService.listModels()

    successResponse(
      res,
      {
        provider: aiService.getProviderName(),
        configuredModel: models[0]?.id ?? null,
        models,
      },
      'Available AI models',
    )
  }),
)

router.post(
  '/summarize',
  asyncHandler(async (req, res) => {
    const body = req.body as { text?: unknown; options?: SummarizeOptions }

    if (typeof body.text !== 'string' || body.text.trim().length === 0) {
      errorResponse(res, '"text" must be a non-empty string.', 400)
      return
    }

    const summary = await aiService.summarize(body.text.trim(), body.options)
    successResponse(res, { summary }, 'Summary generated')
  }),
)

router.post(
  '/generate-reply',
  asyncHandler(async (req, res) => {
    const rawContext = isRecord(req.body)
      ? (isRecord(req.body.context) ? req.body.context : req.body)
      : {}

    if (
      typeof rawContext.originalEmailBody !== 'string' ||
      rawContext.originalEmailBody.trim().length === 0
    ) {
      errorResponse(res, '"originalEmailBody" must be a non-empty string.', 400)
      return
    }

    const context: ReplyContext = {
      originalEmailBody: rawContext.originalEmailBody.trim(),
      originalSubject:
        typeof rawContext.originalSubject === 'string'
          ? rawContext.originalSubject.trim()
          : undefined,
      desiredTone:
        rawContext.desiredTone === 'professional' ||
        rawContext.desiredTone === 'friendly' ||
        rawContext.desiredTone === 'formal' ||
        rawContext.desiredTone === 'casual'
          ? rawContext.desiredTone
          : undefined,
      desiredLength:
        rawContext.desiredLength === 'short' ||
        rawContext.desiredLength === 'medium' ||
        rawContext.desiredLength === 'long'
          ? rawContext.desiredLength
          : undefined,
    }

    const reply = await aiService.generateReply(context)
    successResponse(res, { reply }, 'Reply generated')
  }),
)

router.post(
  '/analyze',
  asyncHandler(async (req, res) => {
    const body = req.body as { text?: unknown }

    if (typeof body.text !== 'string' || body.text.trim().length === 0) {
      errorResponse(res, '"text" must be a non-empty string.', 400)
      return
    }

    const sentiment = await aiService.analyzeSentiment(body.text.trim())
    successResponse(res, { sentiment }, 'Sentiment analyzed')
  }),
)

export default router

import {
  Router,
  type Request,
  type Response,
} from 'express'
import { authMiddleware } from '../middleware'
import { createEmailService } from '../services/email.service'
import { type AuthSession } from '../services/auth.service'
import { type EmailQuery } from '../types/email'
import { asyncHandler } from '../utils/async-handler'
import { errorResponse, successResponse } from '../utils/response'

const router = Router()
const getEmailService = () => createEmailService()

const getSession = (res: Response): AuthSession =>
  res.locals.auth as AuthSession

const parsePositiveNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== 'string') {
    return fallback
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

const parseBooleanValue = (value: unknown): boolean | undefined => {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return undefined
}

const buildQuery = (req: Request): EmailQuery => ({
  limit: parsePositiveNumber(req.query.limit, 20),
  search: typeof req.query.search === 'string' ? req.query.search : undefined,
  pageToken:
    typeof req.query.pageToken === 'string' ? req.query.pageToken : undefined,
  unread: parseBooleanValue(req.query.unread),
  starred: parseBooleanValue(req.query.starred),
})

router.use(authMiddleware)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const session = getSession(res)
    const emailService = getEmailService()
    const emails = await emailService.getMailList(session.tokens, buildQuery(req))
    successResponse(res, emails, 'Inbox loaded')
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = getSession(res)
    const emailService = getEmailService()
    const email = await emailService.getMailDetail(session.tokens, req.params.id)
    successResponse(res, email, 'Email detail loaded')
  }),
)

router.post(
  '/organize',
  asyncHandler(async (req, res) => {
    const session = getSession(res)
    const emailService = getEmailService()
    const body = req.body as {
      limit?: number
      search?: string
      unread?: boolean
      starred?: boolean
    }

    const result = await emailService.organizeMailbox(session.tokens, {
      limit: typeof body.limit === 'number' && body.limit > 0 ? body.limit : 12,
      search: body.search,
      unread: body.unread,
      starred: body.starred,
    })

    successResponse(res, result, 'Mailbox organized')
  }),
)

router.post(
  '/:id/summarize',
  asyncHandler(async (req, res) => {
    const session = getSession(res)
    const emailService = getEmailService()
    const summary = await emailService.summarizeMail(session.tokens, req.params.id)
    successResponse(res, summary, 'Email summarized')
  }),
)

router.post(
  '/:id/reply',
  asyncHandler(async (req, res) => {
    const session = getSession(res)
    const emailService = getEmailService()
    const body = req.body as {
      desiredTone?: 'professional' | 'friendly' | 'formal' | 'casual'
      desiredLength?: 'short' | 'medium' | 'long'
    }

    const reply = await emailService.generateReply(session.tokens, req.params.id, {
      desiredTone: body.desiredTone,
      desiredLength: body.desiredLength,
    })

    successResponse(res, reply, 'Reply draft generated')
  }),
)

router.post(
  '/:id/send',
  asyncHandler(async (req, res) => {
    const session = getSession(res)
    const emailService = getEmailService()
    const body = req.body as {
      to?: string
      subject?: string
      body?: string
    }

    if (!body.body?.trim()) {
      errorResponse(res, 'Reply body is required before sending.', 400)
      return
    }

    const result = await emailService.sendReply(session.tokens, req.params.id, {
      to: body.to?.trim() || '',
      subject: body.subject?.trim() || '',
      body: body.body.trim(),
    })

    successResponse(res, result, 'Reply sent')
  }),
)

router.post(
  '/:id/auto-reply',
  asyncHandler(async (req, res) => {
    const session = getSession(res)
    const emailService = getEmailService()
    const body = req.body as {
      desiredTone?: 'professional' | 'friendly' | 'formal' | 'casual'
      desiredLength?: 'short' | 'medium' | 'long'
    }

    const result = await emailService.generateAndSendReply(
      session.tokens,
      req.params.id,
      {
        desiredTone: body.desiredTone,
        desiredLength: body.desiredLength,
      },
    )

    successResponse(res, result, 'AI reply sent')
  }),
)

export default router

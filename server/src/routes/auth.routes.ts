import {
  Router,
} from 'express'
import { authService } from '../services/auth.service'
import { agentSessionService } from '../services/agent-session.service'
import { asyncHandler } from '../utils/async-handler'
import { errorResponse, successResponse } from '../utils/response'

const router = Router()

router.get(
  '/gmail/connect',
  asyncHandler(async (_req, res) => {
    const { authUrl, state } = await authService.createGmailAuthRequest()

    res.setHeader('Set-Cookie', authService.createStateCookie(state))
    res.redirect(authUrl)
  }),
)

router.get(
  '/oauth/init',
  asyncHandler(async (_req, res) => {
    const { authUrl, state } = await authService.createGmailAuthRequest()

    res.setHeader('Set-Cookie', authService.createStateCookie(state))
    successResponse(res, { authUrl, provider: 'gmail' }, 'OAuth URL generated')
  }),
)

router.get(
  '/oauth/callback',
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const expectedState = authService.getStateFromRequest(req)

    if (!code) {
      res.redirect(authService.buildClientRedirect('error', 'Missing authorization code.'))
      return
    }

    if (!state || !expectedState || state !== expectedState) {
      res.redirect(authService.buildClientRedirect('error', 'OAuth state mismatch.'))
      return
    }

    const session = await authService.createSessionFromCode(code)

    res.setHeader('Set-Cookie', [
      authService.createSessionCookie(session),
      authService.clearStateCookie(),
    ])
    res.redirect(authService.buildClientRedirect('connected'))
  }),
)

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const { session, setCookie } = await authService.loadSession(req)

    if (!session) {
      errorResponse(res, 'Not authenticated with Gmail.', 401)
      return
    }

    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie)
    }

    successResponse(res, session, 'Current Gmail session')
  }),
)

router.get(
  '/agent-session',
  asyncHandler(async (_req, res) => {
    const status = await agentSessionService.getStatus()
    successResponse(res, status, 'Agent session status')
  }),
)

router.post(
  '/agent-session/activate',
  asyncHandler(async (req, res) => {
    const { session, setCookie } = await authService.loadSession(req)

    if (!session) {
      errorResponse(res, 'Connect Gmail in the browser before activating the agent session.', 401)
      return
    }

    await agentSessionService.save(session)

    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie)
    }

    successResponse(
      res,
      {
        active: true,
        email: session.user.email,
        provider: session.provider,
      },
      'Agent session activated',
    )
  }),
)

router.delete(
  '/agent-session',
  asyncHandler(async (_req, res) => {
    await agentSessionService.clear()
    successResponse(res, { active: false }, 'Agent session cleared')
  }),
)

router.delete('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', authService.clearSessionCookie())
  successResponse(res, { disconnected: true }, 'Logged out')
})

export default router

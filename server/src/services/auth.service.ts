import crypto from 'crypto'
import type { Request } from 'express'
import { GmailIntegration } from '../integrations/gmail.integration'
import { AuthTokens } from '../types/email'
import { User } from '../types/user'
import { config } from '../config'
import {
  parseCookies,
  sealCookieValue,
  serializeCookie,
  unsealCookieValue,
} from '../utils/cookies'

export interface GmailMailboxStats {
  messagesTotal: number
  threadsTotal: number
  historyId: string
}

export interface AuthSession {
  provider: 'gmail'
  user: User
  mailbox: GmailMailboxStats
  tokens: AuthTokens
}

interface LoadedSession {
  session: AuthSession | null
  setCookie?: string
}

const SESSION_COOKIE = 'gmail_session'
const STATE_COOKIE = 'gmail_oauth_state'

export class AuthService {
  private readonly gmailIntegration = new GmailIntegration()

  async createGmailAuthRequest(): Promise<{ authUrl: string; state: string }> {
    const state = crypto.randomUUID()
    const auth = await this.gmailIntegration.initializeAuth(state)
    return {
      authUrl: auth.url,
      state,
    }
  }

  createStateCookie(state: string): string {
    return this.createCookie(
      STATE_COOKIE,
      { state, createdAt: Date.now() },
      60 * 10,
    )
  }

  clearStateCookie(): string {
    return serializeCookie(STATE_COOKIE, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: config.nodeEnv === 'production',
      expires: new Date(0),
    })
  }

  getStateFromRequest(req: Request): string | null {
    const cookies = parseCookies(req.headers.cookie)
    const secret = this.getCookieSecret()

    if (!secret) {
      return null
    }

    const payload = cookies[STATE_COOKIE]
      ? unsealCookieValue<{ state: string }>(cookies[STATE_COOKIE], secret)
      : null

    return payload?.state ?? null
  }

  async createSessionFromCode(code: string): Promise<AuthSession> {
    const tokens = await this.gmailIntegration.handleCallback(code)
    const mailbox = await this.gmailIntegration.getProfile(tokens)

    return {
      provider: 'gmail',
      user: {
        id: mailbox.emailAddress,
        email: mailbox.emailAddress,
        name: mailbox.emailAddress.split('@')[0],
      },
      mailbox: {
        messagesTotal: mailbox.messagesTotal,
        threadsTotal: mailbox.threadsTotal,
        historyId: mailbox.historyId,
      },
      tokens,
    }
  }

  createSessionCookie(session: AuthSession): string {
    return this.createCookie(SESSION_COOKIE, session, 60 * 60 * 24 * 14)
  }

  clearSessionCookie(): string {
    return serializeCookie(SESSION_COOKIE, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: config.nodeEnv === 'production',
      expires: new Date(0),
    })
  }

  async loadSession(req: Request): Promise<LoadedSession> {
    const cookies = parseCookies(req.headers.cookie)
    const secret = this.getCookieSecret()

    if (!secret || !cookies[SESSION_COOKIE]) {
      return { session: null }
    }

    const session = unsealCookieValue<AuthSession>(cookies[SESSION_COOKIE], secret)

    if (!session) {
      return { session: null }
    }

    if (
      session.tokens.expiresAt > Date.now() + 60 * 1000 ||
      !session.tokens.refreshToken
    ) {
      return { session }
    }

    try {
      const refreshedTokens = await this.gmailIntegration.refreshToken(
        session.tokens.refreshToken,
      )

      const nextSession: AuthSession = {
        ...session,
        tokens: {
          ...refreshedTokens,
          refreshToken:
            refreshedTokens.refreshToken || session.tokens.refreshToken,
        },
      }

      return {
        session: nextSession,
        setCookie: this.createSessionCookie(nextSession),
      }
    } catch {
      return { session: null }
    }
  }

  buildClientRedirect(status: 'connected' | 'error', message?: string): string {
    const target = new URL(config.clientUrl)
    target.searchParams.set('gmail', status)

    if (message) {
      target.searchParams.set('message', message)
    }

    return target.toString()
  }

  private createCookie(name: string, value: unknown, maxAge: number): string {
    const secret = this.getCookieSecret()

    if (!secret) {
      throw new Error(
        'SESSION_SECRET or JWT_SECRET must be configured before Gmail login can be used.',
      )
    }

    return serializeCookie(name, sealCookieValue(value, secret), {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: config.nodeEnv === 'production',
      maxAge,
    })
  }

  private getCookieSecret(): string | null {
    return config.sessionSecret ?? config.jwtSecret ?? null
  }
}

export const authService = new AuthService()

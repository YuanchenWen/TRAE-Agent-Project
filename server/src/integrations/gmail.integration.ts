import { BaseIntegration } from './base.integration'
import {
  AuthUrl,
  AuthTokens,
  Email,
  EmailAddress,
  EmailAttachment,
  EmailBody,
  EmailListResponse,
  EmailQuery,
  SendEmailOptions,
} from '../types/email'
import { config } from '../config'

interface GmailHeader {
  name?: string
  value?: string
}

interface GmailMessagePart {
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: {
    size?: number
    data?: string
    attachmentId?: string
  }
  parts?: GmailMessagePart[]
}

interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload?: GmailMessagePart
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

interface GmailProfile {
  emailAddress: string
  messagesTotal: number
  threadsTotal: number
  historyId: string
}

const GMAIL_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'

const isPlaceholderValue = (value: string): boolean =>
  !value || /^your[_-]/i.test(value) || /placeholder/i.test(value)

const assertGmailOAuthConfig = (): void => {
  if (
    isPlaceholderValue(config.gmail.clientId) ||
    !/\.apps\.googleusercontent\.com$/.test(config.gmail.clientId)
  ) {
    throw new Error(
      'GMAIL_CLIENT_ID is invalid. Use the Web OAuth client ID from Google Cloud, which normally ends with .apps.googleusercontent.com.',
    )
  }

  if (isPlaceholderValue(config.gmail.clientSecret)) {
    throw new Error(
      'GMAIL_CLIENT_SECRET is invalid. Replace the placeholder with the real OAuth client secret from Google Cloud.',
    )
  }

  if (!config.gmail.redirectUri) {
    throw new Error(
      'GMAIL_REDIRECT_URI is missing. It should usually be http://localhost:3001/api/auth/oauth/callback for local development.',
    )
  }
}

const decodeBase64Url = (value?: string): string => {
  if (!value) {
    return ''
  }

  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/')
  const paddingLength = (4 - (normalizedValue.length % 4)) % 4

  return Buffer.from(normalizedValue + '='.repeat(paddingLength), 'base64').toString('utf8')
}

const findHeader = (headers: GmailHeader[] | undefined, name: string): string => {
  const header = headers?.find(
    (item) => item.name?.toLowerCase() === name.toLowerCase(),
  )
  return header?.value ?? ''
}

const parseSingleAddress = (value: string): EmailAddress => {
  const trimmedValue = value.trim()
  const match = trimmedValue.match(/^(.*?)(?:\s*<([^>]+)>)?$/)

  if (!match) {
    return { email: trimmedValue }
  }

  const name = match[1]?.replace(/^"|"$/g, '').trim()
  const email = match[2]?.trim() || trimmedValue

  return {
    email,
    ...(name ? { name } : {}),
  }
}

const parseAddressList = (value: string): EmailAddress[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseSingleAddress)

const encodeBase64Url = (value: string): string =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const collectBodyContent = (part: GmailMessagePart | undefined): EmailBody => {
  const plainParts: string[] = []
  const htmlParts: string[] = []

  const walk = (currentPart: GmailMessagePart | undefined): void => {
    if (!currentPart) {
      return
    }

    if (currentPart.mimeType === 'text/plain' && currentPart.body?.data) {
      plainParts.push(decodeBase64Url(currentPart.body.data))
    }

    if (currentPart.mimeType === 'text/html' && currentPart.body?.data) {
      htmlParts.push(decodeBase64Url(currentPart.body.data))
    }

    currentPart.parts?.forEach(walk)
  }

  walk(part)

  return {
    ...(plainParts.length > 0 ? { plain: plainParts.join('\n').trim() } : {}),
    ...(htmlParts.length > 0 ? { html: htmlParts.join('\n').trim() } : {}),
  }
}

const collectAttachments = (part: GmailMessagePart | undefined): EmailAttachment[] => {
  const attachments: EmailAttachment[] = []

  const walk = (currentPart: GmailMessagePart | undefined): void => {
    if (!currentPart) {
      return
    }

    if (currentPart.filename && currentPart.body?.attachmentId) {
      attachments.push({
        id: currentPart.body.attachmentId,
        filename: currentPart.filename,
        mimeType: currentPart.mimeType ?? 'application/octet-stream',
        size: currentPart.body.size ?? 0,
      })
    }

    currentPart.parts?.forEach(walk)
  }

  walk(part)
  return attachments
}

const formatDateQuery = (value: Date): string => {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

const buildGmailQuery = (query: EmailQuery): string | undefined => {
  const parts: string[] = []

  if (query.search) {
    parts.push(query.search)
  }

  if (query.unread) {
    parts.push('is:unread')
  }

  if (query.starred) {
    parts.push('is:starred')
  }

  if (query.after) {
    parts.push(`after:${formatDateQuery(query.after)}`)
  }

  if (query.before) {
    parts.push(`before:${formatDateQuery(query.before)}`)
  }

  return parts.length > 0 ? parts.join(' ') : undefined
}

export class GmailIntegration extends BaseIntegration {
  getId(): string {
    return 'gmail'
  }

  getName(): string {
    return 'Gmail'
  }

  async initializeAuth(state: string = ''): Promise<AuthUrl> {
    assertGmailOAuthConfig()

    const params = new URLSearchParams({
      client_id: config.gmail.clientId,
      redirect_uri: config.gmail.redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPE,
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      state,
    })

    return {
      url: `${GMAIL_AUTH_URL}?${params.toString()}`,
      state,
    }
  }

  async handleCallback(code: string): Promise<AuthTokens> {
    assertGmailOAuthConfig()

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: config.gmail.clientId,
        client_secret: config.gmail.clientSecret,
        redirect_uri: config.gmail.redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const payload = (await response.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      scope?: string
      token_type?: string
      error?: string
      error_description?: string
    }

    if (!response.ok || !payload.access_token) {
      throw new Error(payload.error_description ?? payload.error ?? 'Failed to exchange Gmail OAuth code.')
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? '',
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
      scope: payload.scope,
      tokenType: payload.token_type,
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    assertGmailOAuthConfig()

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.gmail.clientId,
        client_secret: config.gmail.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    const payload = (await response.json()) as {
      access_token?: string
      expires_in?: number
      scope?: string
      token_type?: string
      error?: string
      error_description?: string
    }

    if (!response.ok || !payload.access_token) {
      throw new Error(payload.error_description ?? payload.error ?? 'Failed to refresh Gmail access token.')
    }

    return {
      accessToken: payload.access_token,
      refreshToken,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
      scope: payload.scope,
      tokenType: payload.token_type,
    }
  }

  async listEmails(tokens: AuthTokens, query: EmailQuery): Promise<EmailListResponse> {
    const params = new URLSearchParams({
      maxResults: String(Math.min(query.limit ?? 20, 50)),
    })

    const gmailQuery = buildGmailQuery(query)
    if (gmailQuery) {
      params.set('q', gmailQuery)
    }

    if (query.pageToken) {
      params.set('pageToken', query.pageToken)
    }

    const response = await this.gmailFetch<GmailListResponse>(
      `/messages?${params.toString()}`,
      tokens.accessToken,
    )

    const emails = await Promise.all(
      (response.messages ?? []).map(async (message) =>
        this.getMessageMetadata(tokens.accessToken, message.id),
      ),
    )

    return {
      emails,
      pagination: {
        page: query.page ?? 1,
        limit: Math.min(query.limit ?? 20, 50),
        total: response.resultSizeEstimate ?? emails.length,
        hasMore: Boolean(response.nextPageToken),
        ...(response.nextPageToken ? { nextPageToken: response.nextPageToken } : {}),
      },
    }
  }

  async getEmail(tokens: AuthTokens, id: string): Promise<Email> {
    const response = await this.gmailFetch<GmailMessage>(
      `/messages/${id}?format=full`,
      tokens.accessToken,
    )

    return this.mapMessage(response, true)
  }

  async sendEmail(
    tokens: AuthTokens,
    to: string,
    subject: string,
    body: string,
    options?: SendEmailOptions,
  ): Promise<{ id: string; threadId?: string }> {
    const headers = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
    ]

    if (options?.inReplyTo) {
      headers.push(`In-Reply-To: ${options.inReplyTo}`)
    }

    if (options?.references) {
      headers.push(`References: ${options.references}`)
    }

    const rawMessage = `${headers.join('\r\n')}\r\n\r\n${body}`

    const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodeBase64Url(rawMessage),
        ...(options?.threadId ? { threadId: options.threadId } : {}),
      }),
    })

    const payload = (await response.json()) as {
      id?: string
      threadId?: string
      error?: {
        message?: string
      }
    }

    if (!response.ok || !payload.id) {
      const message = payload.error?.message ?? `Gmail send failed (${response.status}).`

      if (
        response.status === 403 &&
        /insufficient authentication scopes/i.test(message)
      ) {
        throw new Error(
          'Current Gmail session does not have send permission yet. Disconnect Gmail and connect again to grant the updated send scope.',
        )
      }

      throw new Error(message)
    }

    return {
      id: payload.id,
      threadId: payload.threadId,
    }
  }

  async testConnection(): Promise<boolean> {
    return true
  }

  async getProfile(tokens: AuthTokens): Promise<GmailProfile> {
    return this.gmailFetch<GmailProfile>('/profile', tokens.accessToken)
  }

  private async getMessageMetadata(accessToken: string, id: string): Promise<Email> {
    const params = new URLSearchParams({
      format: 'metadata',
    })

    ;['From', 'To', 'Cc', 'Bcc', 'Subject', 'Date'].forEach((header) =>
      params.append('metadataHeaders', header),
    )

    const response = await this.gmailFetch<GmailMessage>(
      `/messages/${id}?${params.toString()}`,
      accessToken,
    )

    return this.mapMessage(response, false)
  }

  private async gmailFetch<T>(path: string, accessToken: string): Promise<T> {
    const response = await fetch(`${GMAIL_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const payload = (await response.json()) as T & {
      error?: {
        message?: string
      }
    }

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Gmail API request failed (${response.status}).`)
    }

    return payload
  }

  private mapMessage(message: GmailMessage, includeBody: boolean): Email {
    const headers = message.payload?.headers ?? []
    const body = collectBodyContent(message.payload)
    const attachments = collectAttachments(message.payload)

    return {
      id: message.id,
      threadId: message.threadId,
      messageId: findHeader(headers, 'Message-ID') || undefined,
      references: findHeader(headers, 'References') || undefined,
      from: parseSingleAddress(findHeader(headers, 'From')),
      replyTo: parseAddressList(findHeader(headers, 'Reply-To')),
      to: parseAddressList(findHeader(headers, 'To')),
      cc: parseAddressList(findHeader(headers, 'Cc')),
      bcc: parseAddressList(findHeader(headers, 'Bcc')),
      subject: findHeader(headers, 'Subject') || '(No Subject)',
      snippet: message.snippet ?? '',
      date: message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : new Date().toISOString(),
      ...(includeBody ? { body } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      isRead: !(message.labelIds ?? []).includes('UNREAD'),
      isStarred: (message.labelIds ?? []).includes('STARRED'),
      labels: message.labelIds ?? [],
    }
  }
}

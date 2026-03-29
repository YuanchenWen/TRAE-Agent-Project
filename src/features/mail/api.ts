import type {
  ApiEnvelope,
  AuthSession,
  Email,
  EmailListPayload,
  OrganizePayload,
  ReplyDraftPayload,
  ReplyLength,
  ReplyTone,
  SendReplyPayload,
} from './types'

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!response.ok || !payload) {
    throw new Error(
      payload?.error ?? payload?.message ?? `Request failed with status ${response.status}`,
    )
  }

  if (payload.data === undefined) {
    throw new Error(payload.message ?? 'Missing response payload.')
  }

  return payload.data
}

const postJson = <T>(url: string, body?: Record<string, unknown>): Promise<T> =>
  fetchJson<T>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

export const mailApi = {
  getSession(): Promise<AuthSession> {
    return fetchJson<AuthSession>('/api/auth/me')
  },

  initOAuth(): Promise<{ authUrl: string; provider: string }> {
    return fetchJson<{ authUrl: string; provider: string }>('/api/auth/oauth/init')
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'DELETE' })
  },

  listEmails(search: string): Promise<EmailListPayload> {
    return fetchJson<EmailListPayload>(
      `/api/emails?limit=18&search=${encodeURIComponent(search)}`,
    )
  },

  getEmail(emailId: string): Promise<Email> {
    return fetchJson<Email>(`/api/emails/${emailId}`)
  },

  organizeMailbox(search: string): Promise<OrganizePayload> {
    return postJson<OrganizePayload>('/api/emails/organize', {
      search,
      unread: search.includes('is:unread') ? true : undefined,
      limit: 10,
    })
  },

  summarizeEmail(emailId: string): Promise<{ summary: string }> {
    return postJson<{ summary: string }>(`/api/emails/${emailId}/summarize`)
  },

  generateReply(
    emailId: string,
    desiredTone: ReplyTone,
    desiredLength: ReplyLength,
  ): Promise<ReplyDraftPayload> {
    return postJson<ReplyDraftPayload>(`/api/emails/${emailId}/reply`, {
      desiredTone,
      desiredLength,
    })
  },

  sendReply(
    emailId: string,
    payload: { to: string; subject: string; body: string },
  ): Promise<SendReplyPayload> {
    return postJson<SendReplyPayload>(`/api/emails/${emailId}/send`, payload)
  },

  autoReply(
    emailId: string,
    desiredTone: ReplyTone,
    desiredLength: ReplyLength,
  ): Promise<SendReplyPayload> {
    return postJson<SendReplyPayload>(`/api/emails/${emailId}/auto-reply`, {
      desiredTone,
      desiredLength,
    })
  },
}

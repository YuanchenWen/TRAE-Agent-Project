export interface AuthSession {
  provider: 'gmail'
  user: {
    id: string
    email: string
    name?: string
  }
  mailbox: {
    messagesTotal: number
    threadsTotal: number
    historyId: string
  }
}

export interface EmailAddress {
  name?: string
  email: string
}

export interface Email {
  id: string
  threadId: string
  from: EmailAddress
  to: EmailAddress[]
  subject: string
  snippet: string
  date: string
  body?: {
    plain?: string
    html?: string
  }
  isRead: boolean
  isStarred: boolean
  labels: string[]
}

export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface EmailListPayload {
  emails: Email[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
    nextPageToken?: string
  }
}

export interface OrganizePayload {
  summary: string
  emails: Email[]
}

export interface ReplyDraftPayload {
  replyDraft: {
    to: string
    subject: string
    body: string
  }
}

export interface SendReplyPayload {
  sentMessageId: string
  threadId: string
  replyDraft?: {
    to: string
    subject: string
    body: string
  }
}

export type ReplyTone = 'professional' | 'friendly' | 'formal' | 'casual'

export type ReplyLength = 'short' | 'medium' | 'long'

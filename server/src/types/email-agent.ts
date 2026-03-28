import { type Email, type ReplySuggestion } from './email'

export type EmailAgentAction = 'summarize' | 'draft_reply'
export type MailboxScope = 'inbox' | 'all_mail'

export interface EmailAgentSearchHints {
  sender?: string
  subject?: string
  keywords?: string[]
  after?: string
  before?: string
  unread?: boolean
  starred?: boolean
  rawQuery?: string
}

export interface EmailAgentIntent {
  action: EmailAgentAction
  usePreviousMatch: boolean
  mailboxScope: MailboxScope
  searchHints: EmailAgentSearchHints
  desiredTone?: 'professional' | 'friendly' | 'formal' | 'casual'
  desiredLength?: 'short' | 'medium' | 'long'
}

export interface EmailAgentContext {
  lastMatchedEmailId?: string
  lastMatchedThreadId?: string
  confirmedEmailId?: string
  selectedEmailId?: string
}

export interface EmailAgentCandidate {
  id: string
  threadId: string
  subject: string
  from: Email['from']
  date: string
  snippet: string
}

export interface EmailCandidateResolution {
  selectedEmailId?: string
  confidence: number
  reason: string
  candidateIds: string[]
}

export interface EmailAgentResult {
  status: 'completed' | 'needs_disambiguation' | 'not_found'
  action: EmailAgentAction
  assistantMessage: string
  matchedEmail?: Email
  candidates?: EmailAgentCandidate[]
  summary?: string
  replyDraft?: ReplySuggestion
  context: {
    lastMatchedEmailId?: string
    lastMatchedThreadId?: string
  }
}

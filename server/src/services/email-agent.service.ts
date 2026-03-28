import { AIProvider } from '../ai/base.ai'
import { EmailService } from './email.service'
import { AuthTokens, Email, EmailQuery } from '../types/email'
import {
  EmailAgentCandidate,
  EmailAgentContext,
  EmailAgentIntent,
  EmailAgentResult,
} from '../types/email-agent'

const DEFAULT_SEARCH_LIMIT = 12
const DETAIL_RANKING_LIMIT = 8
const AUTO_SELECT_CONFIDENCE = 0.75

const truncateText = (value: string | undefined, maxLength: number): string => {
  if (!value) {
    return ''
  }

  const normalizedValue = value.replace(/\s+/g, ' ').trim()

  if (normalizedValue.length <= maxLength) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, maxLength - 1)}…`
}

const parseDateString = (value: string | undefined, fallbackToEndOfDay: boolean): Date | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }

  const suffix = fallbackToEndOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'
  const date = new Date(`${value}${suffix}`)

  return Number.isNaN(date.getTime()) ? undefined : date
}

const hasSearchHints = (intent: EmailAgentIntent): boolean => {
  const { searchHints } = intent

  return Boolean(
    searchHints.sender ||
      searchHints.subject ||
      searchHints.rawQuery ||
      searchHints.after ||
      searchHints.before ||
      searchHints.unread !== undefined ||
      searchHints.starred !== undefined ||
      (searchHints.keywords && searchHints.keywords.length > 0),
  )
}

const buildSearchString = (intent: EmailAgentIntent): string => {
  const parts: string[] = []
  const { searchHints } = intent

  if (intent.mailboxScope === 'inbox') {
    parts.push('in:inbox')
  }

  if (searchHints.rawQuery) {
    parts.push(searchHints.rawQuery)
  } else {
    if (searchHints.sender) {
      parts.push(`from:${searchHints.sender}`)
    }

    if (searchHints.subject) {
      parts.push(`subject:(${searchHints.subject})`)
    }

    if (searchHints.keywords?.length) {
      parts.push(...searchHints.keywords)
    }
  }

  if (!hasSearchHints(intent)) {
    parts.push('newer_than:30d')
  }

  return parts.join(' ').trim()
}

const toCandidate = (email: Email): EmailAgentCandidate => ({
  id: email.id,
  threadId: email.threadId,
  subject: email.subject,
  from: email.from,
  date: email.date,
  snippet: email.snippet,
})

const toAgentCandidate = (candidate: EmailAgentCandidate): EmailAgentCandidate => ({
  id: candidate.id,
  threadId: candidate.threadId,
  subject: candidate.subject,
  from: candidate.from,
  date: candidate.date,
  snippet: candidate.snippet,
})

const getContextFromEmail = (email: Email | undefined): EmailAgentResult['context'] =>
  email
    ? {
        lastMatchedEmailId: email.id,
        lastMatchedThreadId: email.threadId,
      }
    : {}

export class EmailAgentService {
  constructor(
    private readonly emailService: EmailService,
    private readonly aiProvider: AIProvider,
  ) {}

  async run(tokens: AuthTokens, message: string, context: EmailAgentContext = {}): Promise<EmailAgentResult> {
    const trimmedMessage = message.trim()

    if (!trimmedMessage) {
      throw new Error('Agent message is required.')
    }

    const intent = await this.aiProvider.interpretEmailCommand(trimmedMessage)

    const confirmedEmail = context.confirmedEmailId
      ? await this.safeGetEmail(tokens, context.confirmedEmailId)
      : null

    if (confirmedEmail) {
      return this.completeAction(tokens, intent, confirmedEmail)
    }

    if (intent.usePreviousMatch) {
      const previousEmailId = context.lastMatchedEmailId ?? context.selectedEmailId

      if (previousEmailId) {
        const previousEmail = await this.safeGetEmail(tokens, previousEmailId)

        if (previousEmail) {
          return this.completeAction(tokens, intent, previousEmail)
        }
      }
    }

    const query = this.buildEmailQuery(intent)
    const list = await this.emailService.getMailList(tokens, query)

    if (list.emails.length === 0) {
      return {
        status: 'not_found',
        action: intent.action,
        assistantMessage: 'I could not find a matching email. Try adding sender, subject, or a time hint.',
        context: {},
      }
    }

    if (list.emails.length === 1) {
      const matchedEmail = await this.emailService.getMailDetail(tokens, list.emails[0].id)
      return this.completeAction(tokens, intent, matchedEmail)
    }

    const metadataCandidates = list.emails
      .slice(0, DETAIL_RANKING_LIMIT)
      .map((email) => toCandidate(email))

    const rankingCandidates = (
      await Promise.allSettled(
        list.emails.slice(0, DETAIL_RANKING_LIMIT).map(async (email) => {
          const detail = await this.emailService.getMailDetail(tokens, email.id)

          return {
            ...toCandidate(detail),
            bodyPreview: truncateText(detail.body?.plain ?? detail.body?.html, 800),
          }
        }),
      )
    ).flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))

    if (rankingCandidates.length === 1) {
      const matchedEmail = await this.emailService.getMailDetail(tokens, rankingCandidates[0].id)
      return this.completeAction(tokens, intent, matchedEmail)
    }

    if (rankingCandidates.length === 0) {
      return {
        status: 'needs_disambiguation',
        action: intent.action,
        assistantMessage:
          'I found several possible emails, but could not safely inspect them all. Pick one to continue.',
        candidates: metadataCandidates.slice(0, 3),
        context: {},
      }
    }

    let resolution

    try {
      resolution = await this.aiProvider.resolveEmailCandidate({
        message: trimmedMessage,
        intent,
        candidates: rankingCandidates,
      })
    } catch {
      return {
        status: 'needs_disambiguation',
        action: intent.action,
        assistantMessage:
          'I found several possible emails, but ranking them failed. Pick one to continue.',
        candidates: rankingCandidates.slice(0, 3).map((candidate) => toAgentCandidate(candidate)),
        context: {},
      }
    }

    const selectedEmailId = resolution.selectedEmailId
    const matchedCandidate = selectedEmailId
      ? rankingCandidates.find((candidate) => candidate.id === selectedEmailId)
      : undefined

    if (matchedCandidate && resolution.confidence >= AUTO_SELECT_CONFIDENCE) {
      const matchedEmail = await this.emailService.getMailDetail(tokens, matchedCandidate.id)
      return this.completeAction(tokens, intent, matchedEmail)
    }

    const candidateIds =
      resolution.candidateIds.length > 0
        ? resolution.candidateIds
        : rankingCandidates.map((candidate) => candidate.id)

    const candidates = candidateIds
      .map((candidateId) =>
        rankingCandidates.find((candidate) => candidate.id === candidateId),
      )
      .filter((candidate): candidate is (typeof rankingCandidates)[number] => Boolean(candidate))
      .slice(0, 3)
      .map((candidate) => toAgentCandidate(candidate))

    if (candidates.length === 0) {
      return {
        status: 'not_found',
        action: intent.action,
        assistantMessage: 'I found messages in Gmail, but none matched closely enough. Try a more specific description.',
        context: {},
      }
    }

    return {
      status: 'needs_disambiguation',
      action: intent.action,
      assistantMessage: resolution.reason,
      candidates,
      context: {},
    }
  }

  private buildEmailQuery(intent: EmailAgentIntent): EmailQuery {
    return {
      limit: DEFAULT_SEARCH_LIMIT,
      search: buildSearchString(intent),
      unread: intent.searchHints.unread,
      starred: intent.searchHints.starred,
      after: parseDateString(intent.searchHints.after, false),
      before: parseDateString(intent.searchHints.before, true),
    }
  }

  private async completeAction(
    tokens: AuthTokens,
    intent: EmailAgentIntent,
    email: Email,
  ): Promise<EmailAgentResult> {
    if (intent.action === 'summarize') {
      const summary = await this.emailService.summarizeMail(tokens, email.id)

      return {
        status: 'completed',
        action: intent.action,
        assistantMessage: 'I found the email and summarized it.',
        matchedEmail: email,
        summary: summary.summary,
        context: getContextFromEmail(email),
      }
    }

    const reply = await this.emailService.generateReply(tokens, email.id, {
      desiredTone: intent.desiredTone,
      desiredLength: intent.desiredLength,
    })

    return {
      status: 'completed',
      action: intent.action,
      assistantMessage: 'I found the email and drafted a reply.',
      matchedEmail: email,
      replyDraft: reply.replyDraft,
      context: getContextFromEmail(email),
    }
  }

  private async safeGetEmail(tokens: AuthTokens, emailId: string): Promise<Email | null> {
    try {
      return await this.emailService.getMailDetail(tokens, emailId)
    } catch {
      return null
    }
  }
}

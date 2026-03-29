import { createEmailService } from './email.service'
import { type AuthSession } from './auth.service'
import type {
  Email,
  ReplySuggestion,
} from '../types/email'

export type MailToolName =
  | 'search_emails'
  | 'read_email'
  | 'list_account_emails'
  | 'send_email'

export interface ToolExecutionResult {
  tool: MailToolName
  label: string
  detail?: string
  output: Record<string, unknown>
}

const MAX_SEARCH_RESULTS = 8

const stripHtml = (value: string): string =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()

const getReadableBody = (email: Email): string =>
  email.body?.plain?.trim() || stripHtml(email.body?.html ?? '')

const senderLabel = (email: Email): string => email.from.name || email.from.email

export class MailToolsService {
  private readonly emailService = createEmailService()

  async execute(
    session: AuthSession,
    tool: MailToolName,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    switch (tool) {
      case 'search_emails':
        return this.searchEmails(session, args)
      case 'read_email':
        return this.readEmail(session, args)
      case 'list_account_emails':
        return this.listAccountEmails(session)
      case 'send_email':
        return this.sendEmail(session, args)
      default:
        throw new Error(`Unsupported tool: ${tool satisfies never}`)
    }
  }

  private async searchEmails(
    session: AuthSession,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const query = typeof args.query === 'string' ? args.query.trim() : ''
    const detailOverride = typeof args.detail === 'string' ? args.detail.trim() : ''
    const limit =
      typeof args.limit === 'number' && args.limit > 0
        ? Math.min(args.limit, MAX_SEARCH_RESULTS)
        : MAX_SEARCH_RESULTS

    if (!query) {
      throw new Error('search_emails requires a non-empty query.')
    }

    const result = await this.emailService.getMailList(session.tokens, {
      search: query,
      limit,
    })

    return {
      tool: 'search_emails',
      label: 'Search Emails',
      detail: detailOverride || query,
      output: {
        query,
        total: result.pagination.total,
        emails: result.emails.map((email) => ({
          id: email.id,
          from: senderLabel(email),
          subject: email.subject,
          snippet: email.snippet,
          date: email.date,
        })),
      },
    }
  }

  private async readEmail(
    session: AuthSession,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const emailId = typeof args.emailId === 'string' ? args.emailId.trim() : ''

    if (!emailId) {
      throw new Error('read_email requires an emailId.')
    }

    const email = await this.emailService.getMailDetail(session.tokens, emailId)

    return {
      tool: 'read_email',
      label: 'Read Email',
      detail: email.subject,
      output: {
        id: email.id,
        from: senderLabel(email),
        fromEmail: email.from.email,
        subject: email.subject,
        to: email.to.map((item) => item.name || item.email),
        body: getReadableBody(email),
        snippet: email.snippet,
        date: email.date,
        replyTo: email.replyTo?.[0]?.email ?? email.from.email,
      },
    }
  }

  private async listAccountEmails(session: AuthSession): Promise<ToolExecutionResult> {
    return {
      tool: 'list_account_emails',
      label: 'List Account Emails',
      detail: session.user.email,
      output: {
        activeAccount: session.user.email,
        provider: session.provider,
      },
    }
  }

  private async sendEmail(
    session: AuthSession,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const emailId = typeof args.emailId === 'string' ? args.emailId.trim() : ''
    const to = typeof args.to === 'string' ? args.to.trim() : ''
    const subject = typeof args.subject === 'string' ? args.subject.trim() : ''
    const body = typeof args.body === 'string' ? args.body.trim() : ''

    if (!emailId || !body) {
      throw new Error('send_email requires emailId and body.')
    }

    const result = await this.emailService.sendReply(session.tokens, emailId, {
      to,
      subject,
      body,
    } as ReplySuggestion)

    return {
      tool: 'send_email',
      label: 'Send Email',
      detail: subject || '(No subject)',
      output: {
        sentMessageId: result.sentMessageId,
        threadId: result.threadId,
        to,
        subject,
        from: session.user.email,
      },
    }
  }
}

export const mailToolsService = new MailToolsService()

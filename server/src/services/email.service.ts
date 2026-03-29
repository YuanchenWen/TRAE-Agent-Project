import { BaseIntegration } from '../integrations/base.integration'
import { IntegrationRegistry } from '../integrations/registry'
import { AIProvider } from '../ai/base.ai'
import { miniMaxAI } from '../ai/provider'
import { registerIntegrations } from '../config/integrations'
import {
  AuthTokens,
  EmailQuery,
  Email,
  ReplySuggestion,
} from '../types/email'
import { ReplyContext } from '../types/integration'

const MAX_EMAIL_BODY_CHARS = 1800

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

const trimForPrompt = (value: string, maxChars: number): string =>
  value.length <= maxChars ? value : `${value.slice(0, maxChars).trimEnd()}...`

const getEmailAiContent = (email: Email): string =>
  email.body?.plain?.trim() || stripHtml(email.body?.html ?? '')

const getReplyRecipient = (email: Email): string =>
  email.replyTo?.[0]?.email ?? email.from.email

const getReplySubject = (subject: string): string =>
  subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`

export class EmailService {
  private readonly integration: BaseIntegration
  private readonly aiProvider: AIProvider

  constructor(integrationId: string = 'gmail', aiProvider: AIProvider = miniMaxAI) {
    registerIntegrations()

    const integration = IntegrationRegistry.getInstance().get(integrationId)

    if (!integration) {
      throw new Error(`Integration "${integrationId}" is not registered.`)
    }

    this.integration = integration
    this.aiProvider = aiProvider
  }

  async getMailList(tokens: AuthTokens, query: EmailQuery) {
    return this.integration.listEmails(tokens, query)
  }

  async getMailDetail(tokens: AuthTokens, emailId: string) {
    return this.integration.getEmail(tokens, emailId)
  }

  async summarizeMail(tokens: AuthTokens, emailId: string) {
    const email = await this.integration.getEmail(tokens, emailId)
    const content = email ? getEmailAiContent(email) : ''

    if (!email || !content) {
      throw new Error('Email not found or no readable body for summarization.')
    }

    const summary = await this.aiProvider.summarize(content)
    return { summary, keyPoints: [] }
  }

  async generateReply(
    tokens: AuthTokens,
    emailId: string,
    options: Pick<ReplyContext, 'desiredTone' | 'desiredLength'>,
  ) {
    const email = await this.integration.getEmail(tokens, emailId)
    const content = email ? getEmailAiContent(email) : ''

    if (!email || !content) {
      throw new Error('Email not found or no readable body for reply generation.')
    }

    const replyContext: ReplyContext = {
      originalEmailBody: content,
      originalSubject: email.subject,
      desiredTone: options.desiredTone,
      desiredLength: options.desiredLength,
    }
    const replyDraft = await this.aiProvider.generateReply(replyContext)
    return {
      replyDraft: {
        ...replyDraft,
        to: getReplyRecipient(email),
        subject:
          replyDraft.subject === 'Re:'
            ? getReplySubject(email.subject)
            : replyDraft.subject,
      },
    }
  }

  async sendReply(
    tokens: AuthTokens,
    emailId: string,
    replyContent: ReplySuggestion,
  ) {
    const email = await this.integration.getEmail(tokens, emailId)
    if (!email) {
      throw new Error('Original email not found.')
    }

    const sendResult = await this.integration.sendEmail(
      tokens,
      replyContent.to || getReplyRecipient(email),
      replyContent.subject || getReplySubject(email.subject),
      replyContent.body,
      {
        threadId: email.threadId,
        inReplyTo: email.messageId,
        references: email.references || email.messageId,
      },
    )
    return {
      sentMessageId: sendResult.id,
      threadId: sendResult.threadId ?? email.threadId,
    }
  }

  async generateAndSendReply(
    tokens: AuthTokens,
    emailId: string,
    options: Pick<ReplyContext, 'desiredTone' | 'desiredLength'>,
  ) {
    const reply = await this.generateReply(tokens, emailId, options)
    const result = await this.sendReply(tokens, emailId, reply.replyDraft)

    return {
      ...result,
      replyDraft: reply.replyDraft,
    }
  }

  async organizeMailbox(
    tokens: AuthTokens,
    query: EmailQuery,
  ): Promise<{ summary: string; emails: Email[] }> {
    const list = await this.integration.listEmails(tokens, query)
    const detailEmails = await Promise.all(
      list.emails.map(async (email) => this.integration.getEmail(tokens, email.id)),
    )

    const digestInput = detailEmails
      .map(
        (email, index) =>
          `Email ${index + 1}
From: ${email.from.email}
Subject: ${email.subject}
Date: ${email.date}
Snippet: ${email.snippet}
Body:
${trimForPrompt(getEmailAiContent(email) || '(No body)', MAX_EMAIL_BODY_CHARS)}
`,
      )
      .join('\n---\n')

    const summary = await this.aiProvider.summarize(
      `Organize the following inbox items. Identify urgent items, pending actions, and low-priority FYI messages.\n\n${digestInput}`,
      {
        format: 'bullet',
        maxLength: 220,
      },
    )

    return {
      summary,
      emails: detailEmails,
    }
  }
}

export const createEmailService = (integrationId: string = 'gmail'): EmailService =>
  new EmailService(integrationId, miniMaxAI)

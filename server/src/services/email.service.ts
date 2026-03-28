import { BaseIntegration } from '../integrations/base.integration'
import { IntegrationRegistry } from '../integrations/registry'
import { AIProvider } from '../ai/base.ai'
import {
  AuthTokens,
  EmailQuery,
  Email,
  ReplySuggestion,
} from '../types/email'
import { ReplyContext } from '../types/integration'

export class EmailService {
  private readonly integration: BaseIntegration
  private readonly aiProvider: AIProvider

  constructor(integrationId: string, aiProvider: AIProvider) {
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
    if (!email || !email.body?.plain) {
      throw new Error('Email not found or no plain text body for summarization.')
    }
    const summary = await this.aiProvider.summarize(email.body.plain)
    return { summary, keyPoints: [] }
  }

  async generateReply(
    tokens: AuthTokens,
    emailId: string,
    options: Pick<ReplyContext, 'desiredTone' | 'desiredLength'>,
  ) {
    const email = await this.integration.getEmail(tokens, emailId)
    if (!email || !email.body?.plain) {
      throw new Error('Email not found or no plain text body for reply generation.')
    }
    const replyContext: ReplyContext = {
      originalEmailBody: email.body.plain,
      originalSubject: email.subject,
      desiredTone: options.desiredTone,
      desiredLength: options.desiredLength,
    }
    const replyDraft = await this.aiProvider.generateReply(replyContext)
    return {
      replyDraft: {
        ...replyDraft,
        to: email.replyTo?.[0]?.email ?? email.from.email,
        subject: replyDraft.subject === 'Re:' ? `Re: ${email.subject}` : replyDraft.subject,
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
      replyContent.to || email.replyTo?.[0]?.email || email.from.email,
      replyContent.subject || `Re: ${email.subject}`,
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
${email.body?.plain ?? email.body?.html ?? '(No body)'}
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

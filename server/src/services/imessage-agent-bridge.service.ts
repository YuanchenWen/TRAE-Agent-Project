import {
  IMessageSDK,
  type Message,
} from '@photon-ai/imessage-kit'
import Database from 'better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import { config } from '../config'
import { agentService, type AgentMessage, type AgentPendingAction, type AgentResponse } from './agent.service'
import { agentSessionService } from './agent-session.service'

interface ConversationState {
  history: AgentMessage[]
  pendingAction?: AgentPendingAction
}

const MAX_HISTORY_MESSAGES = 12
const IMESSAGE_DB_PATH = path.join(os.homedir(), 'Library', 'Messages', 'chat.db')
const MAX_SMS_SUMMARY_SENTENCES = 5
const MAX_SMS_LIST_SENTENCES = 2
const SMS_DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const normalizeIncomingText = (message: string, triggerPrefix: string): string =>
  message.startsWith(triggerPrefix)
    ? message.slice(triggerPrefix.length).trim()
    : message.trim()

const hasTriggerPrefix = (message: string, triggerPrefix: string): boolean =>
  message.trim().startsWith(triggerPrefix)

const appendHistory = (history: AgentMessage[], next: AgentMessage): AgentMessage[] =>
  [...history, next].slice(-MAX_HISTORY_MESSAGES)

const normalizeSmsText = (value: string): string =>
  value
    .replace(/\*\*/g, '')
    .replace(/^[*-]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()

const truncateToSentences = (value: string, maxSentences: number): string => {
  const normalizedValue = normalizeSmsText(value)

  if (!normalizedValue) {
    return '暂无摘要'
  }

  const sentences =
    normalizedValue.match(/[^。！？!?]+[。！？!?]?/g)?.map((item) => item.trim()).filter(Boolean) ??
    [normalizedValue]

  return sentences.slice(0, maxSentences).join(' ')
}

const formatSmsDate = (value: string): string => {
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return SMS_DATE_FORMATTER.format(parsedDate)
}

const renderArtifact = (artifact: AgentResponse['artifacts'][number]): string => {
  if (artifact.type === 'email_list') {
    return [
      artifact.title,
      '',
      artifact.emails
        .map(
          (email, index) =>
            `${index + 1}. 发件人：${email.from}\n主题：${email.subject}\n摘要：${truncateToSentences(email.snippet || '', MAX_SMS_LIST_SENTENCES)}\n时间：${formatSmsDate(email.date)}`,
        )
        .join('\n\n'),
    ].join('\n')
  }

  if (artifact.type === 'email_summary') {
    const combinedSummary = [artifact.summary, ...artifact.bullets].join(' ')
    return [
      `发件人：${artifact.from}`,
      `主题：${artifact.subject}`,
      `摘要：${truncateToSentences(combinedSummary, MAX_SMS_SUMMARY_SENTENCES)}`,
    ].join('\n')
  }

  if (artifact.type === 'reply_draft') {
    return [
      '我已经起草好一封回复。',
      `主题：${artifact.subject}`,
      `草稿摘要：${truncateToSentences(artifact.body, MAX_SMS_SUMMARY_SENTENCES)}`,
    ].join('\n')
  }

  return [
    '回复已发送成功',
    `收件人：${artifact.to}`,
    `主题：${artifact.subject}`,
  ].join('\n')
}

const renderAgentResponse = (response: AgentResponse): string => {
  const parts: string[] = []

  if (response.artifacts.length > 0) {
    parts.push(response.artifacts.map(renderArtifact).join('\n\n'))
  } else {
    parts.push(response.intro)
  }

  if (response.pendingAction?.type === 'send_reply') {
    parts.push('如果你想直接发送，回复“发送”就可以；如果要改，直接告诉我怎么改。')
  } else if (response.artifacts.some((artifact) => artifact.type === 'email_list')) {
    parts.push('告诉我你想看哪一封，我继续帮你读。')
  }

  return parts.filter(Boolean).join('\n\n')
}

export class IMessageAgentBridgeService {
  private sdk: IMessageSDK | null = null
  private started = false
  private lastError: string | null = null
  private shuttingDownFromWatcherError = false
  private readonly conversations = new Map<string, ConversationState>()
  private readonly processedMessageIds = new Set<string>()

  async start(): Promise<void> {
    if (this.started || !config.imessage.enabled) {
      return
    }

    try {
      const db = new Database(IMESSAGE_DB_PATH, {
        readonly: true,
        fileMustExist: true,
      })
      db.close()
    } catch {
      this.lastError = `Cannot open ${IMESSAGE_DB_PATH}. Grant Full Disk Access to the app or terminal that runs this project.`
      this.started = false
      console.warn(this.lastError)
      return
    }

    this.sdk = new IMessageSDK({
      debug: config.imessage.debug,
      watcher: {
        pollInterval: config.imessage.pollInterval,
        unreadOnly: false,
        excludeOwnMessages: true,
      },
    })

    try {
      await this.sdk.startWatching({
        onDirectMessage: async (message) => {
          await this.handleIncomingMessage(message)
        },
        onError: (error) => {
          this.lastError = error instanceof Error ? error.message : String(error)
          this.started = false
          console.error('iMessage watcher error:', error)

          const errorCode =
            typeof error === 'object' && error !== null && 'code' in error
              ? String((error as { code?: unknown }).code ?? '')
              : ''

          if (errorCode === 'DATABASE' && !this.shuttingDownFromWatcherError) {
            this.shuttingDownFromWatcherError = true
            void this.stop().finally(() => {
              this.shuttingDownFromWatcherError = false
            })
          }
        },
      })

      this.started = true
      this.lastError = null
      console.log('iMessage agent bridge started.')
    } catch (error) {
      this.started = false
      this.lastError = error instanceof Error ? error.message : String(error)
      await this.sdk.close().catch(() => undefined)
      this.sdk = null
      throw error
    }
  }

  async stop(): Promise<void> {
    this.started = false

    if (!this.sdk) {
      return
    }

    this.sdk.stopWatching()
    await this.sdk.close()
    this.sdk = null
    this.started = false
  }

  getStatus(): {
    enabled: boolean
    started: boolean
    triggerPrefix: string
    allowedSenders: string[]
    lastError: string | null
  } {
    return {
      enabled: config.imessage.enabled,
      started: this.started,
      triggerPrefix: config.imessage.triggerPrefix,
      allowedSenders: config.imessage.allowedSenders,
      lastError: this.lastError,
    }
  }

  private async handleIncomingMessage(message: Message): Promise<void> {
    if (!this.sdk || this.processedMessageIds.has(message.id)) {
      return
    }

    this.processedMessageIds.add(message.id)

    const rawText = message.text?.trim()

    if (!rawText) {
      return
    }

    if (
      config.imessage.allowedSenders.length > 0 &&
      !config.imessage.allowedSenders.includes(message.sender)
    ) {
      return
    }

    const state = this.conversations.get(message.chatId) ?? { history: [] }
    const shouldHandle =
      Boolean(state.pendingAction) ||
      hasTriggerPrefix(rawText, config.imessage.triggerPrefix)

    if (!shouldHandle) {
      return
    }

    const session = await agentSessionService.load()

    if (!session) {
      await this.sdk.send(
        message.chatId,
        'Mail agent 还没有绑定 Gmail 会话。请先打开本地网页，连接 Gmail，然后激活 agent session。',
      )
      return
    }

    const userText = normalizeIncomingText(rawText, config.imessage.triggerPrefix)

    const response = await agentService.handleMessage({
      session,
      message: userText,
      locale: 'zh-CN',
      history: state.history,
      pendingAction: state.pendingAction,
    })

    const nextHistory = appendHistory(
      appendHistory(state.history, { role: 'user', content: userText }),
      { role: 'assistant', content: response.prompt },
    )

    this.conversations.set(message.chatId, {
      history: nextHistory,
      pendingAction: response.pendingAction,
    })

    await this.sdk.send(message.chatId, renderAgentResponse(response))
  }
}

export const imessageAgentBridgeService = new IMessageAgentBridgeService()

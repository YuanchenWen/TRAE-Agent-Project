import { aiService } from './ai.service'
import { type AuthSession } from './auth.service'
import {
  mailToolsService,
  type MailToolName,
  type ToolExecutionResult,
} from './mail-tools.service'
import type { ReplySuggestion } from '../types/email'

type AgentToolStatus = 'completed' | 'failed'
type AgentPendingActionType = 'send_reply'
type PendingReplyIntent = 'send' | 'revise' | 'hold'

interface PlannerToolResponse {
  type: 'tool'
  tool: MailToolName
  arguments?: Record<string, unknown>
}

interface PlannerFinalResponse {
  type: 'final'
  threadTitle?: string
  intro?: string
  summary?: string
  prompt?: string
  replyDraft?: {
    to?: string
    subject?: string
    body?: string
  }
}

type PlannerResponse = PlannerToolResponse | PlannerFinalResponse

interface SearchCandidate {
  query: string
  detail: string
}

interface PendingReplyIntentResponse {
  intent: PendingReplyIntent
  reason?: string
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentPendingAction {
  type: AgentPendingActionType
  emailId: string
  draft: ReplySuggestion
}

export interface AgentToolStep {
  label: string
  status: AgentToolStatus
  detail?: string
}

export type AgentArtifact =
  | {
      type: 'email_list'
      title: string
      emails: Array<{
        id: string
        from: string
        subject: string
        snippet: string
        date: string
      }>
    }
  | {
      type: 'email_summary'
      from: string
      subject: string
      summary: string
      bullets: string[]
    }
  | {
      type: 'reply_draft'
      to: string
      subject: string
      body: string
    }
  | {
      type: 'send_result'
      to: string
      from: string
      subject: string
      sentMessageId: string
    }

export interface AgentResponse {
  threadTitle: string
  intro: string
  steps: AgentToolStep[]
  artifacts: AgentArtifact[]
  prompt: string
  pendingAction?: AgentPendingAction
}

const DEFAULT_THREAD_TITLE = 'Mail Agent'
const MAX_TOOL_STEPS = 4
const MAX_EMAIL_BODY_CHARS = 4500
const MAX_SEARCH_CANDIDATES = 6
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const GMAIL_OPERATOR_PATTERN =
  /\b(from|to|subject|after|before|is|in|label|category|newer_than|older_than|has)\s*:/i
const COMMON_SEARCH_STOPWORDS = new Set([
  '帮我',
  '一下',
  '一下下',
  '查',
  '找',
  '搜',
  '搜索',
  '查询',
  '查看',
  '看看',
  '看下',
  '邮件',
  '邮箱',
  '发给我',
  '给我发',
  '发我的',
  '发来的',
  '回复',
  '回信',
  '起草',
  '草拟',
  '直接',
  '发送',
  '并',
  '然后',
  '再',
  '请',
  '麻烦',
  '需要',
  '帮忙',
  '找到',
  '找到我',
  '发我',
  '内容',
  '读取',
  '阅读',
  '给我的',
])

const EMAIL_BLOCK_PATTERNS = [
  /^(不要发|先别发|别发|暂时别发|先不要发送|先不要发|不用发|不发)$/u,
]
const EMAIL_REVISION_HINT_PATTERNS = [
  /(修改|改一下|改成|重写|重来|润色|调整|补充|删掉|删除|换成|换个|简短一点|正式一点|口语一点|语气|内容)/u,
]

const safeJsonParse = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

const trimForPrompt = (value: string, maxChars: number): string =>
  value.length <= maxChars ? value : `${value.slice(0, maxChars).trimEnd()}...`

const normalizeIntentText = (message: string): string =>
  message
    .trim()
    .toLowerCase()
    .replace(/[，。！？、；：,.!?;:\s]/g, '')

const isBlockedSendMessage = (message: string): boolean =>
  EMAIL_BLOCK_PATTERNS.some((pattern) => pattern.test(message.trim()))

const isRevisionMessage = (message: string): boolean =>
  EMAIL_REVISION_HINT_PATTERNS.some((pattern) => pattern.test(message.trim()))

const getFallbackPendingReplyIntent = (message: string): PendingReplyIntent => {
  const trimmedMessage = message.trim()

  if (!trimmedMessage || isBlockedSendMessage(trimmedMessage)) {
    return 'hold'
  }

  if (isRevisionMessage(trimmedMessage)) {
    return 'revise'
  }

  const normalizedText = normalizeIntentText(trimmedMessage)
  const sendTokens = [
    '确定',
    '确认',
    '可以',
    '行',
    '好的',
    '好',
    '嗯',
    '发送',
    '发吧',
    '发出',
    '发给他',
    '发给她',
    '发给ta',
    'send',
    'ok',
    'okay',
  ]

  return sendTokens.some((token) => normalizedText.includes(token)) ? 'send' : 'revise'
}

const extractBullets = (summary: string): string[] =>
  summary
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)

const buildThreadTitle = (value: string | undefined): string =>
  value?.trim() || DEFAULT_THREAD_TITLE

const normalizeSearchQuery = (value: string): string =>
  value
    .replace(/@mail/gi, '')
    .replace(/[，。！？]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeNaturalMessage = (value: string): string =>
  value
    .replace(/@mail/gi, ' ')
    .replace(/[，。！？、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildSearchContext = (
  message: string,
  history: AgentMessage[] | undefined,
): string =>
  [
    ...(history
      ?.filter((item) => item.role === 'user')
      .slice(-3)
      .map((item) => item.content) ?? []),
    message,
  ]
    .map(normalizeNaturalMessage)
    .filter(Boolean)
    .join(' ')

const escapeQuotedValue = (value: string): string => value.replace(/"/g, '\\"').trim()

const stripReplyClauses = (value: string): string =>
  value
    .replace(
      /\s*(?:并且|并|然后|再|顺便)?\s*(?:起草|草拟|写(?:一封|个)?|回|回复|回信|发送)(?:邮件|一下|一封回复|回复邮件)?[\s\S]*$/u,
      ' ',
    )
    .replace(
      /\s*(?:并且|并|然后|再|顺便)?\s*(?:直接)?\s*(?:帮我)?(?:回|回复|发送)[\s\S]*$/u,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()

const stripLeadingSearchBoilerplate = (value: string): string =>
  value
    .replace(
      /^(?:请|麻烦|帮我|请帮我|想让你|可以帮我|能不能帮我|帮忙|我想让你|我想请你)\s*/u,
      '',
    )
    .replace(/^(?:查一下|找一下|搜一下|查找|搜索|查询|查看|看看|看下|找|查|搜)\s*/u, '')
    .trim()

const extractEmailHints = (value: string): string[] =>
  Array.from(new Set(value.match(EMAIL_PATTERN)?.map((item) => item.toLowerCase()) ?? []))

const extractSenderHint = (value: string): string | null => {
  const normalized = stripLeadingSearchBoilerplate(stripReplyClauses(normalizeNaturalMessage(value)))
  const patterns = [
    /(.+?)\s*(?:发给我|给我发|发我的|发来(?:的)?|写给我|寄给我)(?:的)?(?:邮件|邮箱内容)?$/u,
    /(?:from|sender)\s+(.+)$/iu,
    /^(.+?)(?:,|，)?\s*名字是这个$/u,
    /^名字是\s*(.+)$/u,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const candidate = match?.[1]
      ?.replace(/\s*(?:的)?(?:邮件|邮箱内容|消息).*$/u, '')
      ?.replace(/^(?:那个|这个|叫做|来自)\s*/u, '')
      ?.trim()

    if (candidate && candidate.length >= 2 && candidate.length <= 60) {
      return candidate
    }
  }

  return null
}

const extractQuotedPhrases = (value: string): string[] =>
  Array.from(
    new Set(
      Array.from(value.matchAll(/["“'‘](.+?)["”'’]/g))
        .map((match) => match[1]?.trim())
        .filter((item): item is string => Boolean(item && item.length >= 2)),
    ),
  )

const extractKeywordHints = (value: string, senderHint: string | null): string[] => {
  const base = stripLeadingSearchBoilerplate(stripReplyClauses(normalizeNaturalMessage(value)))
    .replace(senderHint ?? '', ' ')
    .replace(EMAIL_PATTERN, ' ')
    .replace(/最新收到的邮件|最近收到的邮件|最新邮件|最近邮件|最新收到|最近收到/gu, ' ')
    .replace(/有给我邮件吗|有发我邮件吗|给我发了啥|给我发了什么|发给我的邮件|给我发的邮件/gu, ' ')
    .replace(/名字是这个|帮我查一下|帮我查|查一下|看一下|看下|告诉我/gu, ' ')

  const tokens = base.match(/[A-Za-z][A-Za-z0-9._-]*|[\u4e00-\u9fff]{2,12}/g) ?? []

  return Array.from(
    new Set(
      tokens
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !COMMON_SEARCH_STOPWORDS.has(token)),
    ),
  ).slice(0, 4)
}

const isConcreteQuery = (value: string): boolean => {
  const normalized = normalizeSearchQuery(value)

  if (!normalized) {
    return false
  }

  if (GMAIL_OPERATOR_PATTERN.test(normalized) || EMAIL_PATTERN.test(normalized)) {
    return true
  }

  return normalized.length <= 48 && normalized.split(/\s+/).length <= 6
}

const buildSearchCandidates = (
  message: string,
  history: AgentMessage[] | undefined,
  preferredQuery?: string,
): SearchCandidate[] => {
  const candidates: SearchCandidate[] = []
  const seenQueries = new Set<string>()
  const context = buildSearchContext(message, history)
  const senderHint = extractSenderHint(context)
  const emailHints = extractEmailHints(context)
  const quotedPhrases = extractQuotedPhrases(context)
  const keywordHints = extractKeywordHints(context, senderHint)
  const latestInboxIntent =
    /(最新|最近|latest|recent)/iu.test(context) &&
    /(邮件|邮箱|mail|email)/iu.test(context)

  const addCandidate = (query: string, detail: string): void => {
    const normalizedQuery = query.trim()

    if (!normalizedQuery || seenQueries.has(normalizedQuery) || candidates.length >= MAX_SEARCH_CANDIDATES) {
      return
    }

    seenQueries.add(normalizedQuery)
    candidates.push({
      query: normalizedQuery,
      detail,
    })
  }

  if (preferredQuery && isConcreteQuery(preferredQuery)) {
    addCandidate(normalizeSearchQuery(preferredQuery), '按指定条件搜索')
  }

  if (latestInboxIntent) {
    addCandidate('in:inbox', '查看最新收件箱邮件')
  }

  emailHints.forEach((email) => {
    addCandidate(`from:${email}`, `按发件邮箱 ${email} 搜索`)
  })

  if (senderHint) {
    addCandidate(`from:"${escapeQuotedValue(senderHint)}"`, `按发件人 ${senderHint} 搜索`)
    addCandidate(`"${escapeQuotedValue(senderHint)}"`, `按姓名关键词 ${senderHint} 搜索`)
    addCandidate(senderHint, `按关键词 ${senderHint} 搜索`)
  }

  quotedPhrases.forEach((phrase) => {
    addCandidate(`subject:"${escapeQuotedValue(phrase)}"`, `按主题 ${phrase} 搜索`)
    addCandidate(`"${escapeQuotedValue(phrase)}"`, `按短语 ${phrase} 搜索`)
  })

  if (keywordHints.length > 0) {
    keywordHints.forEach((keyword) => {
      addCandidate(keyword, `按关键词 ${keyword} 搜索`)
    })
    addCandidate(keywordHints.join(' '), `按关键词 ${keywordHints.join(' / ')} 搜索`)
  }

  if (!senderHint && !preferredQuery && keywordHints.length === 0) {
    const normalized = normalizeSearchQuery(context)
    if (normalized) {
      addCandidate(normalized, '按请求中的关键词搜索')
    }
  }

  return candidates
}

const toolDescriptions = [
  {
    name: 'search_emails',
    description: 'Search Gmail emails by Gmail search query. Use this first.',
  },
  {
    name: 'read_email',
    description: 'Read the full body of one email. Requires an emailId from search results.',
  },
  {
    name: 'list_account_emails',
    description: 'Get the active account email address. Use before sending if needed.',
  },
  {
    name: 'send_email',
    description:
      'Send the final email reply. Only use this after the user explicitly confirms sending.',
  },
]

const formatExecutionResults = (results: ToolExecutionResult[]): string =>
  results.length === 0
    ? 'No tools executed yet.'
    : results
        .map((item, index) => {
          const output = JSON.stringify(item.output, null, 2)
          return `Tool ${index + 1}: ${item.tool}\nLabel: ${item.label}\nDetail: ${item.detail ?? ''}\nOutput:\n${trimForPrompt(output, 5000)}`
        })
        .join('\n\n')

const formatHistory = (history: AgentMessage[] | undefined): string =>
  history && history.length > 0
    ? history
        .slice(-6)
        .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
        .join('\n')
    : 'No conversation history.'

const getLastToolResult = (
  results: ToolExecutionResult[],
  tool: MailToolName,
): ToolExecutionResult | undefined => [...results].reverse().find((item) => item.tool === tool)

export class AgentService {
  async handleMessage(input: {
    session: AuthSession
    message: string
    history?: AgentMessage[]
    pendingAction?: AgentPendingAction
  }): Promise<AgentResponse> {
    const trimmedMessage = input.message.trim()

    if (!trimmedMessage) {
      throw new Error('Message is required.')
    }

    if (input.pendingAction?.type === 'send_reply') {
      const pendingReplyIntent = await this.classifyPendingReplyIntent(
        trimmedMessage,
        input.pendingAction,
        input.history,
      )

      if (pendingReplyIntent === 'send') {
        return this.sendPendingReply(input.session, input.pendingAction)
      }

      if (pendingReplyIntent === 'hold') {
        return this.holdPendingReply(input.pendingAction)
      }

      return this.revisePendingReply(input.session, trimmedMessage, input.pendingAction)
    }

    return this.runMailAgent(input.session, trimmedMessage, input.history)
  }

  private async runMailAgent(
    session: AuthSession,
    message: string,
    history?: AgentMessage[],
  ): Promise<AgentResponse> {
    const toolResults: ToolExecutionResult[] = []

    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      const plannerResponse = await this.planNextAction(message, history, toolResults)

      if (!plannerResponse) {
        break
      }

      if (plannerResponse.type === 'tool') {
        if (plannerResponse.tool === 'send_email') {
          throw new Error('send_email is blocked until the user explicitly confirms sending.')
        }

        const result =
          plannerResponse.tool === 'search_emails'
            ? await this.executeSearchWithFallback(
                session,
                message,
                history,
                plannerResponse.arguments,
              )
            : await mailToolsService.execute(
                session,
                plannerResponse.tool,
                plannerResponse.arguments ?? {},
              )
        toolResults.push(result)
        continue
      }

      return this.buildFinalResponse(plannerResponse, toolResults)
    }

    return this.fallbackResponse(session, message, history)
  }

  private async planNextAction(
    message: string,
    history: AgentMessage[] | undefined,
    toolResults: ToolExecutionResult[],
  ): Promise<PlannerResponse | null> {
    const response = await aiService.complete({
      system: `You are a mail agent. You may call tools to inspect email before answering.

Available tools:
${toolDescriptions
  .map((tool) => `- ${tool.name}: ${tool.description}`)
  .join('\n')}

Rules:
- Return strict JSON only.
- Use search_emails before read_email unless a specific emailId is already known.
- When using search_emails, never pass the entire user sentence as the query. Prefer sender names, email addresses, subject words, or Gmail operators.
- Never call send_email unless the user explicitly confirms sending.
- Once you have enough context, return a final response.
- Final response JSON shape:
{"type":"final","threadTitle":"short title","intro":"brief intro in Chinese","summary":"Chinese email summary","prompt":"Chinese follow-up prompt","replyDraft":{"to":"recipient","subject":"subject line","body":"reply body"}}
- Tool call JSON shape:
{"type":"tool","tool":"search_emails|read_email|list_account_emails|send_email","arguments":{...}}`,
      prompt: `Conversation history:
${formatHistory(history)}

Latest user request:
${message}

Executed tool results:
${formatExecutionResults(toolResults)}

Return the next JSON action now.`,
      maxTokens: 700,
      temperature: 0.2,
    })

    return safeJsonParse<PlannerResponse>(response)
  }

  private async executeSearchWithFallback(
    session: AuthSession,
    message: string,
    history: AgentMessage[] | undefined,
    argumentsValue: Record<string, unknown> | undefined,
  ): Promise<ToolExecutionResult> {
    const preferredQuery =
      typeof argumentsValue?.query === 'string' ? argumentsValue.query : undefined
    const limit =
      typeof argumentsValue?.limit === 'number' && argumentsValue.limit > 0
        ? argumentsValue.limit
        : 5
    const candidates = buildSearchCandidates(message, history, preferredQuery)
    const attemptedQueries: string[] = []

    for (const candidate of candidates) {
      const result = await mailToolsService.execute(session, 'search_emails', {
        query: candidate.query,
        limit,
        detail: candidate.detail,
      })

      attemptedQueries.push(candidate.query)

      if (Number(result.output.total ?? 0) > 0) {
        return {
          ...result,
          output: {
            ...result.output,
            attemptedQueries,
          },
        }
      }
    }

    const failedDetail =
      candidates.map((item) => item.detail).join('，然后') || '按关键词搜索'

    return {
      tool: 'search_emails',
      label: 'Search Emails',
      detail: failedDetail,
      output: {
        query: candidates[0]?.query ?? normalizeSearchQuery(message),
        total: 0,
        emails: [],
        attemptedQueries,
      },
    }
  }

  private async classifyPendingReplyIntent(
    message: string,
    pendingAction: AgentPendingAction,
    history: AgentMessage[] | undefined,
  ): Promise<PendingReplyIntent> {
    if (isBlockedSendMessage(message)) {
      return 'hold'
    }

    const response = await aiService.complete({
      system: `You are an intent router for an email agent with a drafted reply waiting for user approval.

Classify the user's latest message into one of:
- "send": the user intends to send the drafted email now, even if phrased casually or indirectly.
- "revise": the user wants changes to the draft before sending.
- "hold": the user is not clearly asking to send or revise, or is asking to wait / not send.

Important:
- Short confirmations like "确定", "可以", "嗯，发给他", "发送吧", "就这样", "ok send" usually mean "send".
- Requests to change tone, add/remove content, or rewrite mean "revise".
- "先别发", "不要发", "等等" mean "hold".
- Return strict JSON only: {"intent":"send|revise|hold","reason":"short explanation"}`,
      prompt: `Recent conversation:
${formatHistory(history)}

Pending draft subject:
${pendingAction.draft.subject}

Pending draft body:
${trimForPrompt(pendingAction.draft.body, 1200)}

Latest user message:
${message}

Return the JSON intent now.`,
      maxTokens: 120,
      temperature: 0.1,
    })

    const parsedResponse = safeJsonParse<PendingReplyIntentResponse>(response)
    const intent = parsedResponse?.intent

    if (intent === 'send' || intent === 'revise' || intent === 'hold') {
      return intent
    }

    return getFallbackPendingReplyIntent(message)
  }

  private buildFinalResponse(
    plannerResponse: PlannerFinalResponse,
    toolResults: ToolExecutionResult[],
  ): AgentResponse {
    const searchResult = getLastToolResult(toolResults, 'search_emails')
    const searchOutput = (searchResult?.output ?? {}) as {
      emails?: Array<{
        id: string
        from: string
        subject: string
        snippet: string
        date: string
      }>
    }
    const readResult = getLastToolResult(toolResults, 'read_email')
    const readOutput = (readResult?.output ?? {}) as {
      id?: string
      from?: string
      subject?: string
      body?: string
      replyTo?: string
    }

    const steps = toolResults.map((item) => ({
      label: item.label,
      status: 'completed' as const,
      detail: item.detail,
    }))

    const artifacts: AgentArtifact[] = []

    if (!readOutput.id && searchOutput.emails && searchOutput.emails.length > 0) {
      artifacts.push({
        type: 'email_list',
        title:
          plannerResponse.summary?.trim() ||
          `以下是您最新的 ${searchOutput.emails.length} 封邮件`,
        emails: searchOutput.emails.slice(0, 5),
      })
    }

    if (readOutput.from && readOutput.subject && plannerResponse.summary) {
      artifacts.push({
        type: 'email_summary',
        from: readOutput.from,
        subject: readOutput.subject,
        summary: plannerResponse.summary,
        bullets: extractBullets(plannerResponse.summary),
      })
    }

    const replyDraftBody = plannerResponse.replyDraft?.body?.trim()
    const replyDraftTo = plannerResponse.replyDraft?.to?.trim() || readOutput.replyTo
    const replyDraftSubject =
      plannerResponse.replyDraft?.subject?.trim() || readOutput.subject

    let pendingAction: AgentPendingAction | undefined

    if (readOutput.id && replyDraftBody && replyDraftTo && replyDraftSubject) {
      const normalizedSubject = replyDraftSubject.toLowerCase().startsWith('re:')
        ? replyDraftSubject
        : `Re: ${replyDraftSubject}`

      artifacts.push({
        type: 'reply_draft',
        to: replyDraftTo,
        subject: normalizedSubject,
        body: replyDraftBody,
      })

      pendingAction = {
        type: 'send_reply',
        emailId: readOutput.id,
        draft: {
          to: replyDraftTo,
          subject: normalizedSubject,
          body: replyDraftBody,
        },
      }
    }

    return {
      threadTitle: buildThreadTitle(plannerResponse.threadTitle || readOutput.subject),
      intro: plannerResponse.intro?.trim() || '我已经根据你的要求处理了这封邮件。',
      steps,
      artifacts,
      prompt:
        plannerResponse.prompt?.trim() ||
        (pendingAction
          ? '如果你确认没问题，我就直接帮你发送；如果还要改，继续告诉我。'
          : '如果你还要继续处理其他邮件，直接告诉我。'),
      ...(pendingAction ? { pendingAction } : {}),
    }
  }

  private async sendPendingReply(
    session: AuthSession,
    pendingAction: AgentPendingAction,
  ): Promise<AgentResponse> {
    const accountResult = await mailToolsService.execute(session, 'list_account_emails', {})
    const sendResult = await mailToolsService.execute(session, 'send_email', {
      emailId: pendingAction.emailId,
      to: pendingAction.draft.to,
      subject: pendingAction.draft.subject,
      body: pendingAction.draft.body,
    })

    return {
      threadTitle: buildThreadTitle(pendingAction.draft.subject),
      intro: '好的，我来发送这封回复。',
      steps: [
        {
          label: accountResult.label,
          status: 'completed',
          detail: accountResult.detail,
        },
        {
          label: sendResult.label,
          status: 'completed',
          detail: sendResult.detail,
        },
      ],
      artifacts: [
        {
          type: 'send_result',
          to: pendingAction.draft.to,
          from: String((accountResult.output.activeAccount as string | undefined) ?? session.user.email),
          subject: pendingAction.draft.subject,
          sentMessageId: String(sendResult.output.sentMessageId),
        },
      ],
      prompt: '如果对方回复了，随时告诉我，我可以继续帮你处理后续邮件。',
    }
  }

  private holdPendingReply(pendingAction: AgentPendingAction): AgentResponse {
    return {
      threadTitle: buildThreadTitle(pendingAction.draft.subject),
      intro: '我先不发送，继续保留这版草稿。',
      steps: [
        {
          label: 'Await Confirmation',
          status: 'completed',
          detail: 'Waiting for clearer send or revise intent',
        },
      ],
      artifacts: [
        {
          type: 'reply_draft',
          to: pendingAction.draft.to,
          subject: pendingAction.draft.subject,
          body: pendingAction.draft.body,
        },
      ],
      prompt: '如果你想直接发，告诉我“发吧”或“就这样发送”；如果要改，直接说你想怎么改。',
      pendingAction,
    }
  }

  private async revisePendingReply(
    session: AuthSession,
    revisionRequest: string,
    pendingAction: AgentPendingAction,
  ): Promise<AgentResponse> {
    const readResult = await mailToolsService.execute(session, 'read_email', {
      emailId: pendingAction.emailId,
    })

    const readOutput = readResult.output as {
      subject?: string
      body?: string
      replyTo?: string
    }

    const updatedBody = await aiService.complete({
      system:
        'You revise email drafts. Keep the result ready to send, preserve important facts, and return only the revised email body.',
      prompt: `Original email:\n${trimForPrompt(readOutput.body ?? '', MAX_EMAIL_BODY_CHARS)}\n\nCurrent draft:\n${pendingAction.draft.body}\n\nRevision request:\n${revisionRequest}\n\nReturn only the revised body text.`,
      maxTokens: 1200,
      temperature: 0.4,
    })

    const nextDraft: ReplySuggestion = {
      ...pendingAction.draft,
      to: readOutput.replyTo || pendingAction.draft.to,
      subject: pendingAction.draft.subject,
      body: updatedBody,
    }

    return {
      threadTitle: buildThreadTitle(readOutput.subject || nextDraft.subject),
      intro: '我已经按你的要求改了一版回复。',
      steps: [
        {
          label: 'Read Email',
          status: 'completed',
          detail: readOutput.subject,
        },
        {
          label: 'Revise Draft',
          status: 'completed',
          detail: revisionRequest,
        },
      ],
      artifacts: [
        {
          type: 'reply_draft',
          to: nextDraft.to,
          subject: nextDraft.subject,
          body: nextDraft.body,
        },
      ],
      prompt: '如果这版可以，我就直接帮你发送；如果还要改，继续告诉我想怎么调整。',
      pendingAction: {
        type: 'send_reply',
        emailId: pendingAction.emailId,
        draft: nextDraft,
      },
    }
  }

  private async fallbackResponse(
    session: AuthSession,
    message: string,
    history?: AgentMessage[],
  ): Promise<AgentResponse> {
    const searchResult = await this.executeSearchWithFallback(
      session,
      message,
      history,
      {
        limit: 5,
      },
    )

    const searchOutput = searchResult.output as {
      emails?: Array<{ id: string; subject: string }>
      attemptedQueries?: string[]
    }
    const firstEmail = searchOutput.emails?.[0]

    if (!firstEmail) {
      const triedLabels = searchResult.detail
        ? `我先${searchResult.detail}，但目前还没搜到明显匹配的邮件。`
        : '我先帮你搜了一轮，但目前还没搜到明显匹配的邮件。'

      return {
        threadTitle: DEFAULT_THREAD_TITLE,
        intro: triedLabels,
        steps: [
          {
            label: searchResult.label,
            status: 'failed',
            detail: searchResult.detail,
          },
        ],
        artifacts: [],
        prompt: '你可以继续给我发件邮箱、主题词，或者告诉我大概是什么时候收到的，我再往下搜。',
      }
    }

    const readResult = await mailToolsService.execute(session, 'read_email', {
      emailId: firstEmail.id,
    })
    const readOutput = readResult.output as {
      id: string
      from: string
      subject: string
      body: string
      replyTo: string
    }

    const summary = await aiService.summarize(readOutput.body, {
      format: 'bullet',
      maxLength: 180,
    })

    const draftBody = await aiService.complete({
      system:
        'You write polished email replies. Keep them specific, practical, and ready to send. Do not invent facts.',
      prompt: `User goal:\n${message}\n\nOriginal email subject: ${readOutput.subject}\nOriginal email:\n${trimForPrompt(readOutput.body, MAX_EMAIL_BODY_CHARS)}\n\nReturn only the reply body text.`,
      maxTokens: 1200,
      temperature: 0.4,
    })

    const subject = readOutput.subject.toLowerCase().startsWith('re:')
      ? readOutput.subject
      : `Re: ${readOutput.subject}`

    return {
      threadTitle: buildThreadTitle(readOutput.subject),
      intro: `我来帮你查找 ${readOutput.from} 发给你的邮件。`,
      steps: [
        {
          label: searchResult.label,
          status: 'completed',
          detail: searchResult.detail,
        },
        {
          label: readResult.label,
          status: 'completed',
          detail: readResult.detail,
        },
      ],
      artifacts: [
        {
          type: 'email_summary',
          from: readOutput.from,
          subject,
          summary,
          bullets: extractBullets(summary),
        },
        {
          type: 'reply_draft',
          to: readOutput.replyTo,
          subject,
          body: draftBody,
        },
      ],
      prompt: '你希望我直接发送这封回复，还是需要修改内容？',
      pendingAction: {
        type: 'send_reply',
        emailId: readOutput.id,
        draft: {
          to: readOutput.replyTo,
          subject,
          body: draftBody,
        },
      },
    }
  }
}

export const agentService = new AgentService()

import { AIProvider } from './base.ai'
import { config } from '../config'
import {
  EmailAgentCandidate,
  EmailAgentIntent,
  EmailCandidateResolution,
} from '../types/email-agent'
import {
  SummarizeOptions,
  ReplyContext,
  SentimentResult,
  Model,
} from '../types/integration'
import { ReplySuggestion } from '../types/email'

type MessageRole = 'user' | 'assistant'

interface TextBlock {
  type: 'text'
  text: string
}

interface AnthropicMessage {
  role: MessageRole
  content: TextBlock[]
}

interface ResponseBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: ResponseBlock[]
  error?: {
    message?: string
  }
}

const DOCUMENTED_COMPAT_MODELS = ['MiniMax-M2.5', 'MiniMax-M2.1', 'MiniMax-M2']

const clampTemperature = (value: number | undefined): number | undefined => {
  if (value === undefined) {
    return undefined
  }

  return Math.min(1, Math.max(0.1, value))
}

const extractJsonObject = (value: string): string => {
  const startIndex = value.indexOf('{')
  const endIndex = value.lastIndexOf('}')

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('MiniMax returned a non-JSON sentiment response.')
  }

  return value.slice(startIndex, endIndex + 1)
}

const clampConfidence = (value: unknown): number => {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return 0
  }

  return Math.max(0, Math.min(1, parsedValue))
}

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

const isValidOptionalDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

const normalizeEmailIntent = (value: unknown): EmailAgentIntent => {
  const payload =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}

  const searchHintsValue =
    typeof payload.searchHints === 'object' && payload.searchHints !== null
      ? (payload.searchHints as Record<string, unknown>)
      : {}

  const desiredTone =
    payload.desiredTone === 'professional' ||
    payload.desiredTone === 'friendly' ||
    payload.desiredTone === 'formal' ||
    payload.desiredTone === 'casual'
      ? payload.desiredTone
      : undefined

  const desiredLength =
    payload.desiredLength === 'short' ||
    payload.desiredLength === 'medium' ||
    payload.desiredLength === 'long'
      ? payload.desiredLength
      : undefined

  return {
    action: payload.action === 'draft_reply' ? 'draft_reply' : 'summarize',
    usePreviousMatch: payload.usePreviousMatch === true,
    mailboxScope: payload.mailboxScope === 'all_mail' ? 'all_mail' : 'inbox',
    searchHints: {
      sender:
        typeof searchHintsValue.sender === 'string'
          ? searchHintsValue.sender.trim()
          : undefined,
      subject:
        typeof searchHintsValue.subject === 'string'
          ? searchHintsValue.subject.trim()
          : undefined,
      keywords: normalizeStringArray(searchHintsValue.keywords),
      after: isValidOptionalDate(searchHintsValue.after)
        ? searchHintsValue.after
        : undefined,
      before: isValidOptionalDate(searchHintsValue.before)
        ? searchHintsValue.before
        : undefined,
      unread:
        typeof searchHintsValue.unread === 'boolean'
          ? searchHintsValue.unread
          : undefined,
      starred:
        typeof searchHintsValue.starred === 'boolean'
          ? searchHintsValue.starred
          : undefined,
      rawQuery:
        typeof searchHintsValue.rawQuery === 'string'
          ? searchHintsValue.rawQuery.trim()
          : undefined,
    },
    desiredTone,
    desiredLength,
  }
}

const normalizeCandidateResolution = (value: unknown): EmailCandidateResolution => {
  const payload =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}

  return {
    selectedEmailId:
      typeof payload.selectedEmailId === 'string' && payload.selectedEmailId.trim().length > 0
        ? payload.selectedEmailId.trim()
        : undefined,
    confidence: clampConfidence(payload.confidence),
    reason:
      typeof payload.reason === 'string' && payload.reason.trim().length > 0
        ? payload.reason.trim()
        : 'No ranking reason provided.',
    candidateIds: normalizeStringArray(payload.candidateIds),
  }
}

export class MiniMaxAI extends AIProvider {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly anthropicVersion: string
  private model: string

  constructor() {
    super()
    this.apiKey = config.minimax.apiKey
    this.baseUrl = config.minimax.baseUrl
    this.anthropicVersion = config.minimax.anthropicVersion
    this.model = config.minimax.model
  }

  getProviderName(): string {
    return 'MiniMax'
  }

  async summarize(text: string, options?: SummarizeOptions): Promise<string> {
    const formatInstruction =
      options?.format === 'bullet'
        ? 'Return 3 to 6 concise bullet points.'
        : 'Return one concise paragraph.'
    const maxLengthInstruction = options?.maxLength
      ? `Keep the response under about ${options.maxLength} words.`
      : 'Keep the response brief and high signal.'

    return this.createTextCompletion({
      system:
        'You summarize email and productivity content for end users. Preserve concrete dates, commitments, blockers, and next steps.',
      prompt: `Summarize the following content.\n\nRequirements:\n- ${formatInstruction}\n- ${maxLengthInstruction}\n\nContent:\n${text}`,
      maxTokens: 900,
      temperature: 0.2,
    })
  }

  async generateReply(context: ReplyContext): Promise<ReplySuggestion> {
    const tone = context.desiredTone ?? 'professional'
    const length = context.desiredLength ?? 'medium'
    const subject = context.originalSubject
      ? context.originalSubject.toLowerCase().startsWith('re:')
        ? context.originalSubject
        : `Re: ${context.originalSubject}`
      : 'Re:'

    const body = await this.createTextCompletion({
      system:
        'You write polished email replies. Be specific, accurate, and ready to send. Do not invent facts that are not in the original email.',
      prompt: `Draft an email reply.\n\nRequirements:\n- Tone: ${tone}\n- Length: ${length}\n- Return only the reply body text, with no markdown fences or commentary.\n\nOriginal email:\n${context.originalEmailBody}`,
      maxTokens: 1200,
      temperature: 0.4,
    })

    return {
      to: '',
      subject,
      body,
      suggestedTone: tone,
    }
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    const response = await this.createTextCompletion({
      system: 'You analyze sentiment and return strict JSON only.',
      prompt:
        'Analyze the sentiment of the following text.\nReturn JSON only in this shape: {"sentiment":"positive|negative|neutral","score":0-1}.\n\nText:\n' +
        text,
      maxTokens: 200,
      temperature: 0.1,
    })

    const parsedResult = JSON.parse(extractJsonObject(response)) as Partial<SentimentResult>

    if (
      parsedResult.sentiment !== 'positive' &&
      parsedResult.sentiment !== 'negative' &&
      parsedResult.sentiment !== 'neutral'
    ) {
      throw new Error('MiniMax returned an invalid sentiment label.')
    }

    const score = Number(parsedResult.score)

    return {
      sentiment: parsedResult.sentiment,
      score: Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0.5,
    }
  }

  async interpretEmailCommand(message: string): Promise<EmailAgentIntent> {
    const response = await this.createJsonCompletion<unknown>({
      system:
        'You convert natural-language mail assistant requests into strict JSON for an email agent. Prefer conservative extraction and do not invent filters the user did not imply.',
      prompt: `Interpret the user's email request and return JSON only.\n\nRules:\n- action must be "summarize" or "draft_reply".\n- usePreviousMatch should be true only when the user refers to a previously discussed email such as "that one", "the last one", or "刚才那封".\n- mailboxScope must be "inbox" unless the user explicitly asks to search beyond the inbox.\n- searchHints may include sender, subject, keywords, after, before, unread, starred, rawQuery.\n- after/before must be YYYY-MM-DD when present.\n- desiredTone and desiredLength are only for draft replies.\n- Keep keywords concise and relevant.\n\nReturn this shape exactly:\n{\n  "action": "summarize" | "draft_reply",\n  "usePreviousMatch": boolean,\n  "mailboxScope": "inbox" | "all_mail",\n  "searchHints": {\n    "sender"?: string,\n    "subject"?: string,\n    "keywords"?: string[],\n    "after"?: "YYYY-MM-DD",\n    "before"?: "YYYY-MM-DD",\n    "unread"?: boolean,\n    "starred"?: boolean,\n    "rawQuery"?: string\n  },\n  "desiredTone"?: "professional" | "friendly" | "formal" | "casual",\n  "desiredLength"?: "short" | "medium" | "long"\n}\n\nUser request:\n${message}`,
      maxTokens: 700,
      temperature: 0.1,
    })

    return normalizeEmailIntent(response)
  }

  async resolveEmailCandidate(options: {
    message: string
    intent: EmailAgentIntent
    candidates: Array<
      EmailAgentCandidate & {
        bodyPreview?: string
      }
    >
  }): Promise<EmailCandidateResolution> {
    const response = await this.createJsonCompletion<unknown>({
      system:
        'You are matching a natural-language request to the most likely email candidate. Return strict JSON only. Be conservative when candidates are ambiguous.',
      prompt: `Choose the best matching email candidate for the user's request.\n\nReturn this shape exactly:\n{\n  "selectedEmailId": string | null,\n  "confidence": number,\n  "reason": string,\n  "candidateIds": string[]\n}\n\nRequirements:\n- candidateIds must contain up to 3 candidate ids ranked best to worst.\n- confidence must be between 0 and 1.\n- If no candidate is plausible, set selectedEmailId to null and confidence to 0.\n- Prefer candidates whose sender, subject, date, snippet, and body preview best match the request.\n- If several candidates are close, keep confidence below 0.75.\n\nUser request:\n${options.message}\n\nParsed intent:\n${JSON.stringify(options.intent, null, 2)}\n\nCandidates:\n${JSON.stringify(options.candidates, null, 2)}`,
      maxTokens: 900,
      temperature: 0.1,
    })

    return normalizeCandidateResolution(response)
  }

  listModels(): Model[] {
    const ids = new Set<string>([this.model, ...DOCUMENTED_COMPAT_MODELS])

    return Array.from(ids).map((id) => ({
      id,
      name: id === this.model ? `${id} (configured)` : id,
    }))
  }

  setModel(modelId: string): void {
    this.model = modelId
  }

  private async createTextCompletion(options: {
    system: string
    prompt: string
    maxTokens: number
    temperature?: number
  }): Promise<string> {
    const response = await this.createMessage({
      system: options.system,
      maxTokens: options.maxTokens,
      temperature: clampTemperature(options.temperature),
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: options.prompt }],
        },
      ],
    })

    const text = response.content
      ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text?.trim())
      .filter((block): block is string => Boolean(block))
      .join('\n')
      .trim()

    if (!text) {
      throw new Error('MiniMax returned no text content.')
    }

    return text
  }

  private async createJsonCompletion<T>(options: {
    system: string
    prompt: string
    maxTokens: number
    temperature?: number
  }): Promise<T> {
    const response = await this.createTextCompletion(options)
    return JSON.parse(extractJsonObject(response)) as T
  }

  private async createMessage(options: {
    system: string
    messages: AnthropicMessage[]
    maxTokens: number
    temperature?: number
  }): Promise<AnthropicResponse> {
    if (!this.apiKey) {
      throw new Error(
        'MiniMax is not configured. Set MINIMAX_API_KEY or ANTHROPIC_AUTH_TOKEN before calling the AI routes.',
      )
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'x-api-key': this.apiKey,
        'anthropic-version': this.anthropicVersion,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens,
        system: options.system,
        messages: options.messages,
        ...(options.temperature !== undefined
          ? { temperature: options.temperature }
          : {}),
      }),
    })

    const payload = (await response.json().catch(() => null)) as AnthropicResponse | null

    if (!response.ok) {
      const errorMessage = payload?.error?.message ?? response.statusText
      const modelHint =
        this.model === 'MiniMax-M2.7'
          ? ' Official MiniMax release notes say M2.7 is on the API Platform, but some compatibility docs still list up to M2.5, so keep MINIMAX_MODEL configurable if your account rejects M2.7.'
          : ''

      throw new Error(
        `MiniMax request failed (${response.status}): ${errorMessage}.${modelHint}`,
      )
    }

    return payload ?? {}
  }
}

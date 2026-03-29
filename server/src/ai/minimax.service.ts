import { AIProvider } from './base.ai'
import { config } from '../config'
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

  async complete(options: {
    system: string
    prompt: string
    maxTokens: number
    temperature?: number
  }): Promise<string> {
    return this.createTextCompletion(options)
  }

  async summarize(text: string, options?: SummarizeOptions): Promise<string> {
    const formatInstruction =
      options?.format === 'bullet'
        ? 'Return 3 to 6 concise plain-text bullet points that each start with "- ".'
        : 'Return one concise plain-text paragraph.'
    const maxLengthInstruction = options?.maxLength
      ? `Keep the response under about ${options.maxLength} words.`
      : 'Keep the response brief and high signal.'

    return this.createTextCompletion({
      system:
        'You summarize email and productivity content for end users. Preserve concrete dates, commitments, blockers, and next steps.',
      prompt: `Summarize the following content.\n\nRequirements:\n- ${formatInstruction}\n- ${maxLengthInstruction}\n- Do not add headings like "Summary:" or markdown emphasis like **bold**.\n- Do not wrap the answer in code fences.\n\nContent:\n${text}`,
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

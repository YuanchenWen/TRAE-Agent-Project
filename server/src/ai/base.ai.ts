import { ReplySuggestion } from '../types/email'
import {
  EmailAgentCandidate,
  EmailAgentIntent,
  EmailCandidateResolution,
} from '../types/email-agent'
import {
  SentimentResult,
  Model,
  SummarizeOptions,
  ReplyContext,
} from '../types/integration'

export abstract class AIProvider {
  abstract getProviderName(): string

  abstract summarize(text: string, options?: SummarizeOptions): Promise<string>
  abstract generateReply(context: ReplyContext): Promise<ReplySuggestion>
  abstract analyzeSentiment(text: string): Promise<SentimentResult>
  abstract interpretEmailCommand(message: string): Promise<EmailAgentIntent>
  abstract resolveEmailCandidate(options: {
    message: string
    intent: EmailAgentIntent
    candidates: Array<
      EmailAgentCandidate & {
        bodyPreview?: string
      }
    >
  }): Promise<EmailCandidateResolution>

  abstract listModels(): Model[]
  abstract setModel(modelId: string): void
}

import { ReplySuggestion } from '../types/email'
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

  abstract listModels(): Model[]
  abstract setModel(modelId: string): void
}

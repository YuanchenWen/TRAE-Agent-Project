import { AIProvider } from '../ai/base.ai'
import { MiniMaxAI } from '../ai/minimax.service'
import {
  SummarizeOptions,
  ReplyContext,
  SentimentResult,
  Model,
} from '../types/integration'
import { ReplySuggestion } from '../types/email'

export class AIService {
  constructor(private readonly aiProvider: AIProvider = new MiniMaxAI()) {}

  getProviderName(): string {
    return this.aiProvider.getProviderName()
  }

  async summarize(text: string, options?: SummarizeOptions): Promise<string> {
    return this.aiProvider.summarize(text, options)
  }

  async generateReply(context: ReplyContext): Promise<ReplySuggestion> {
    return this.aiProvider.generateReply(context)
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    return this.aiProvider.analyzeSentiment(text)
  }

  async listModels(): Promise<Model[]> {
    return this.aiProvider.listModels()
  }

  async setModel(modelId: string): Promise<void> {
    this.aiProvider.setModel(modelId)
  }
}

export const aiService = new AIService()

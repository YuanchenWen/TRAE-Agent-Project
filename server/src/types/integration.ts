export interface IntegrationConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
}

export interface ReplyContext {
  originalEmailBody: string;
  originalSubject?: string;
  desiredTone?: "professional" | "friendly" | "formal" | "casual";
  desiredLength?: "short" | "medium" | "long";
}

export interface SummarizeOptions {
  maxLength?: number;
  format?: "paragraph" | "bullet";
}

export interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral";
  score: number;
}

export interface Model {
  id: string;
  name: string;
}

import {
  Email,
  EmailListResponse,
  EmailQuery,
  AuthUrl,
  AuthTokens,
  SendEmailOptions,
} from '../types/email';

export abstract class BaseIntegration {
  abstract getId(): string;
  abstract getName(): string;
  
  abstract initializeAuth(state?: string): Promise<AuthUrl>;
  abstract handleCallback(code: string): Promise<AuthTokens>;
  abstract refreshToken(refreshToken: string): Promise<AuthTokens>;
  
  abstract listEmails(tokens: AuthTokens, query: EmailQuery): Promise<EmailListResponse>;
  abstract getEmail(tokens: AuthTokens, id: string): Promise<Email>;
  abstract sendEmail(
    tokens: AuthTokens,
    to: string,
    subject: string,
    body: string,
    options?: SendEmailOptions,
  ): Promise<{ id: string; threadId?: string }>;
  
  abstract testConnection(): Promise<boolean>;
}

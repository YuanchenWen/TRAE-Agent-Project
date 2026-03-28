export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // Base64 encoded content for fetching
}

export interface EmailBody {
  plain?: string;
  html?: string;
}

export interface Email {
  id: string;
  threadId: string;
  messageId?: string;
  references?: string;
  from: EmailAddress;
  replyTo?: EmailAddress[];
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  snippet: string;
  date: string;
  body?: EmailBody;
  attachments?: EmailAttachment[];
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
}

export interface EmailListResponse {
  emails: Email[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    nextPageToken?: string;
  };
}

export interface ReplySuggestion {
  to: string;
  subject: string;
  body: string;
  suggestedTone?: string;
  alternatives?: ReplySuggestion[];
}

export interface EmailQuery {
  page?: number;
  limit?: number;
  unread?: boolean;
  starred?: boolean;
  after?: Date;
  before?: Date;
  search?: string;
  pageToken?: string;
}

export interface AuthUrl {
  url: string;
  state: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
}

export interface SendEmailOptions {
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

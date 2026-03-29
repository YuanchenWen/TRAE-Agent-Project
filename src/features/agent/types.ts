import type { AuthSession } from '@/features/mail/types'

export type AgentLocale = 'zh-CN' | 'en-US'

export type AgentToolStatus = 'completed' | 'failed'

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

export interface AgentPendingAction {
  type: 'send_reply'
  emailId: string
  draft: {
    to: string
    subject: string
    body: string
  }
}

export interface AgentResponse {
  threadTitle: string
  intro: string
  steps: AgentToolStep[]
  artifacts: AgentArtifact[]
  prompt: string
  pendingAction?: AgentPendingAction
}

export interface AgentHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  response?: AgentResponse
  loading?: boolean
}

export interface AgentViewState {
  authLoading: boolean
  session: AuthSession | null
  flashMessage: string
  threadTitle: string
  composerValue: string
  messages: ChatMessage[]
  sending: boolean
  bridgeStatus: {
    enabled: boolean
    started: boolean
    triggerPrefix: string
    allowedSenders: string[]
    lastError: string | null
  } | null
  agentSessionStatus: {
    active: boolean
    email?: string
    provider?: string
  } | null
  activatingAgentSession: boolean
  onComposerChange: (value: string) => void
  onSubmit: () => void
  onConnectGmail: () => void | Promise<void>
  onLogout: () => void | Promise<void>
  onActivateAgentSession: () => void | Promise<void>
}

import { mailApi } from '@/features/mail/api'
import type {
  AuthSession,
  ApiEnvelope,
} from '@/features/mail/types'
import type {
  AgentLocale,
  AgentHistoryMessage,
  AgentPendingAction,
  AgentResponse,
} from './types'

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!response.ok || !payload) {
    throw new Error(
      payload?.error ?? payload?.message ?? `Request failed with status ${response.status}`,
    )
  }

  if (payload.data === undefined) {
    throw new Error(payload.message ?? 'Missing response payload.')
  }

  return payload.data
}

export const agentApi = {
  getSession(): Promise<AuthSession> {
    return mailApi.getSession()
  },

  initOAuth(): Promise<{ authUrl: string; provider: string }> {
    return mailApi.initOAuth()
  },

  logout(): Promise<void> {
    return mailApi.logout()
  },

  getAgentSessionStatus(): Promise<{
    active: boolean
    email?: string
    provider?: string
  }> {
    return fetchJson('/api/auth/agent-session')
  },

  activateAgentSession(): Promise<{
    active: boolean
    email?: string
    provider?: string
  }> {
    return fetchJson('/api/auth/agent-session/activate', {
      method: 'POST',
    })
  },

  getIMessageStatus(): Promise<{
    enabled: boolean
    started: boolean
    triggerPrefix: string
    allowedSenders: string[]
    lastError: string | null
  }> {
    return fetchJson('/api/imessage/status')
  },

  sendMessage(payload: {
    message: string
    locale?: AgentLocale
    history?: AgentHistoryMessage[]
    pendingAction?: AgentPendingAction
  }): Promise<AgentResponse> {
    return fetchJson<AgentResponse>('/api/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  },
}

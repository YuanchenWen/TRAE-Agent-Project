import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { agentApi } from '../api'
import type {
  AgentHistoryMessage,
  AgentPendingAction,
  AgentViewState,
  ChatMessage,
} from '../types'
import type { AuthSession } from '@/features/mail/types'

const INITIAL_TITLE = 'Mail Agent'

const createId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const getRedirectFlashMessage = (): string => {
  const params = new URLSearchParams(window.location.search)
  const gmailStatus = params.get('gmail')
  const message = params.get('message')

  if (!gmailStatus) {
    return ''
  }

  window.history.replaceState({}, document.title, window.location.pathname)

  if (gmailStatus === 'connected') {
    return 'Gmail connected successfully.'
  }

  if (gmailStatus === 'error') {
    return message || 'Gmail authorization failed.'
  }

  return ''
}

const historyFromMessages = (messages: ChatMessage[]): AgentHistoryMessage[] =>
  messages
    .filter((message) => !message.loading)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))

const initialAssistantMessage: ChatMessage = {
  id: createId(),
  role: 'assistant',
  content:
    '把邮件相关需求直接发给我，比如“查一下谁给我发了 team request，然后先起草一个回复”。我会按 agent 的方式帮你查找、阅读、总结、起草并在确认后发送。',
}

export function useAgentChat(): AgentViewState {
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [flashMessage, setFlashMessage] = useState('')
  const [threadTitle, setThreadTitle] = useState(INITIAL_TITLE)
  const [composerValue, setComposerValue] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistantMessage])
  const [sending, setSending] = useState(false)
  const [pendingAction, setPendingAction] = useState<AgentPendingAction | undefined>()
  const [bridgeStatus, setBridgeStatus] = useState<AgentViewState['bridgeStatus']>(null)
  const [agentSessionStatus, setAgentSessionStatus] = useState<AgentViewState['agentSessionStatus']>(null)
  const [activatingAgentSession, setActivatingAgentSession] = useState(false)

  useEffect(() => {
    setFlashMessage(getRedirectFlashMessage())

    void (async () => {
      setAuthLoading(true)

      try {
        const [nextSession, nextAgentSessionStatus, nextBridgeStatus] = await Promise.all([
          agentApi.getSession(),
          agentApi.getAgentSessionStatus().catch(() => null),
          agentApi.getIMessageStatus().catch(() => null),
        ])
        setSession(nextSession)
        setAgentSessionStatus(nextAgentSessionStatus)
        setBridgeStatus(nextBridgeStatus)
      } catch {
        setSession(null)
      } finally {
        setAuthLoading(false)
      }
    })()
  }, [])

  const connectGmail = async () => {
    try {
      const payload = await agentApi.initOAuth()
      window.location.href = payload.authUrl
    } catch (error) {
      setFlashMessage(
        error instanceof Error
          ? error.message
          : 'Backend is unavailable. Make sure the API server is running.',
      )
    }
  }

  const logout = async () => {
    await agentApi.logout()
    setSession(null)
    setThreadTitle(INITIAL_TITLE)
    setMessages([initialAssistantMessage])
    setPendingAction(undefined)
    setComposerValue('')
  }

  const activateAgentSession = async () => {
    setActivatingAgentSession(true)

    try {
      const status = await agentApi.activateAgentSession()
      setAgentSessionStatus(status)
      setFlashMessage(
        status.email
          ? `Agent session activated for ${status.email}.`
          : 'Agent session activated.',
      )
    } catch (error) {
      setFlashMessage(
        error instanceof Error ? error.message : 'Failed to activate agent session.',
      )
    } finally {
      setActivatingAgentSession(false)
    }
  }

  const onSubmit = useCallback(async () => {
    const message = composerValue.trim()

    if (!message || sending || !session) {
      return
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: message,
    }

    const loadingMessageId = createId()
    const loadingMessage: ChatMessage = {
      id: loadingMessageId,
      role: 'assistant',
      content: pendingAction ? '正在处理你的确认或修改请求…' : '正在分析邮件任务并执行工具步骤…',
      loading: true,
    }

    const nextHistoryMessages = [...messages, userMessage]

    setComposerValue('')
    setSending(true)
    setMessages((current) => [...current, userMessage, loadingMessage])

    try {
      const response = await agentApi.sendMessage({
        message,
        history: historyFromMessages(nextHistoryMessages),
        pendingAction,
      })

      setThreadTitle(response.threadTitle)
      setPendingAction(response.pendingAction)
      setMessages((current) =>
        current.map((item) =>
          item.id === loadingMessageId
            ? {
                id: loadingMessageId,
                role: 'assistant',
                content: response.prompt,
                response,
              }
            : item,
        ),
      )
    } catch (error) {
      setMessages((current) =>
        current.map((item) =>
          item.id === loadingMessageId
            ? {
                id: loadingMessageId,
                role: 'assistant',
                content:
                  error instanceof Error
                    ? error.message
                    : 'Agent request failed.',
              }
            : item,
        ),
      )
    } finally {
      setSending(false)
    }
  }, [composerValue, messages, pendingAction, sending, session])

  return useMemo(
    () => ({
      authLoading,
      session,
      flashMessage,
      threadTitle,
      composerValue,
      messages,
      sending,
      bridgeStatus,
      agentSessionStatus,
      activatingAgentSession,
      onComposerChange: setComposerValue,
      onSubmit,
      onConnectGmail: connectGmail,
      onLogout: logout,
      onActivateAgentSession: activateAgentSession,
    }),
    [
      activatingAgentSession,
      agentSessionStatus,
      authLoading,
      bridgeStatus,
      composerValue,
      flashMessage,
      messages,
      onSubmit,
      sending,
      session,
      threadTitle,
    ],
  )
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { agentApi } from '../api'
import { useAgentI18n } from '../i18n'
import type {
  AgentLocale,
  AgentHistoryMessage,
  AgentPendingAction,
  AgentViewState,
  ChatMessage,
} from '../types'
import type { AuthSession } from '@/features/mail/types'

const createId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const getRedirectFlashMessage = (
  _locale: AgentLocale,
  t: ReturnType<typeof useAgentI18n>['t'],
): string => {
  const params = new URLSearchParams(window.location.search)
  const gmailStatus = params.get('gmail')
  const message = params.get('message')

  if (!gmailStatus) {
    return ''
  }

  window.history.replaceState({}, document.title, window.location.pathname)

  if (gmailStatus === 'connected') {
    return t('flash.gmailConnected')
  }

  if (gmailStatus === 'error') {
    return message || t('flash.gmailAuthorizationFailed')
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

export function useAgentChat(): AgentViewState {
  const { locale, t } = useAgentI18n()
  const initialTitle = t('thread.defaultTitle')
  const initialAssistantMessage = useMemo<ChatMessage>(
    () => ({
      id: 'assistant-welcome',
      role: 'assistant',
      content: t('assistant.welcome'),
    }),
    [t],
  )
  const previousInitialTitleRef = useRef(initialTitle)
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [flashMessage, setFlashMessage] = useState('')
  const [threadTitle, setThreadTitle] = useState(initialTitle)
  const [composerValue, setComposerValue] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(() => [initialAssistantMessage])
  const [sending, setSending] = useState(false)
  const [pendingAction, setPendingAction] = useState<AgentPendingAction | undefined>()
  const [bridgeStatus, setBridgeStatus] = useState<AgentViewState['bridgeStatus']>(null)
  const [agentSessionStatus, setAgentSessionStatus] = useState<AgentViewState['agentSessionStatus']>(null)
  const [activatingAgentSession, setActivatingAgentSession] = useState(false)

  useEffect(() => {
    setMessages((current) =>
      current.length === 1 && current[0]?.id === 'assistant-welcome'
        ? [{ ...current[0], content: t('assistant.welcome') }]
        : current,
    )

    setThreadTitle((current) =>
      current === previousInitialTitleRef.current ? initialTitle : current,
    )

    previousInitialTitleRef.current = initialTitle
  }, [initialTitle, t])

  useEffect(() => {
    setFlashMessage(getRedirectFlashMessage(locale, t))

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
  }, [locale, t])

  const connectGmail = useCallback(async () => {
    try {
      const payload = await agentApi.initOAuth()
      window.location.href = payload.authUrl
    } catch (error) {
      setFlashMessage(
        error instanceof Error
          ? error.message
          : t('flash.backendUnavailable'),
      )
    }
  }, [t])

  const logout = useCallback(async () => {
    await agentApi.logout()
    setSession(null)
    setThreadTitle(initialTitle)
    setMessages([initialAssistantMessage])
    setPendingAction(undefined)
    setComposerValue('')
  }, [initialAssistantMessage, initialTitle])

  const activateAgentSession = useCallback(async () => {
    setActivatingAgentSession(true)

    try {
      const status = await agentApi.activateAgentSession()
      setAgentSessionStatus(status)
      setFlashMessage(
        status.email
          ? t('flash.agentSessionActivatedFor', { email: status.email })
          : t('flash.agentSessionActivated'),
      )
    } catch (error) {
      setFlashMessage(
        error instanceof Error ? error.message : t('flash.activateAgentSessionFailed'),
      )
    } finally {
      setActivatingAgentSession(false)
    }
  }, [t])

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
      content: pendingAction ? t('assistant.loadingPending') : t('assistant.loadingTask'),
      loading: true,
    }

    const nextHistoryMessages = [...messages, userMessage]

    setComposerValue('')
    setSending(true)
    setMessages((current) => [...current, userMessage, loadingMessage])

    try {
      const response = await agentApi.sendMessage({
        message,
        locale,
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
                    : t('assistant.requestFailed'),
              }
            : item,
        ),
      )
    } finally {
      setSending(false)
    }
  }, [composerValue, locale, messages, pendingAction, sending, session, t])

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
      activateAgentSession,
      connectGmail,
      logout,
      messages,
      onSubmit,
      sending,
      session,
      threadTitle,
    ],
  )
}

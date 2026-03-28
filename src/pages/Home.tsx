import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  Inbox,
  LoaderCircle,
  LogOut,
  Mail,
  MessageSquareText,
  RefreshCw,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react'

interface AuthSession {
  provider: 'gmail'
  user: {
    id: string
    email: string
    name?: string
  }
  mailbox: {
    messagesTotal: number
    threadsTotal: number
    historyId: string
  }
}

interface EmailAddress {
  name?: string
  email: string
}

interface Email {
  id: string
  threadId: string
  from: EmailAddress
  to: EmailAddress[]
  subject: string
  snippet: string
  date: string
  body?: {
    plain?: string
    html?: string
  }
  isRead: boolean
  isStarred: boolean
  labels: string[]
}

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface EmailListPayload {
  emails: Email[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
    nextPageToken?: string
  }
}

interface OrganizePayload {
  summary: string
  emails: Email[]
}

interface ReplyDraftPayload {
  replyDraft: {
    to: string
    subject: string
    body: string
  }
}

interface SendReplyPayload {
  sentMessageId: string
  threadId: string
  replyDraft?: {
    to: string
    subject: string
    body: string
  }
}

interface EmailAgentContextPayload {
  lastMatchedEmailId?: string
  lastMatchedThreadId?: string
  confirmedEmailId?: string
  selectedEmailId?: string
}

interface EmailAgentCandidatePayload {
  id: string
  threadId: string
  subject: string
  from: EmailAddress
  date: string
  snippet: string
}

interface EmailAgentResponse {
  status: 'completed' | 'needs_disambiguation' | 'not_found'
  action: 'summarize' | 'draft_reply'
  assistantMessage: string
  matchedEmail?: Email
  candidates?: EmailAgentCandidatePayload[]
  summary?: string
  replyDraft?: {
    to: string
    subject: string
    body: string
  }
  context: {
    lastMatchedEmailId?: string
    lastMatchedThreadId?: string
  }
}

interface AgentChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  candidates?: EmailAgentCandidatePayload[]
  command?: string
}

interface StoredMatchedEmail {
  id: string
  threadId: string
  subject: string
  fromLabel: string
  date: string
}

interface DetailLoadOptions {
  resetAiOutputs?: boolean
}

type ReplyTone = 'professional' | 'friendly' | 'formal' | 'casual'
type ReplyLength = 'short' | 'medium' | 'long'

const sectionLabelClass =
  'text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-stone-500'
const agentContextStorageKey = 'trae-agent-email-context'
const agentMatchStorageKey = 'trae-agent-email-match'
const initialAgentMessages: AgentChatMessage[] = [
  {
    id: 'agent-welcome',
    role: 'assistant',
    text:
      'Describe the email you want. I can find it, summarize it, or draft a reply for it.',
  },
]

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const rawText = await response.text()
  let payload: ApiEnvelope<T> | null = null

  if (rawText) {
    try {
      payload = JSON.parse(rawText) as ApiEnvelope<T>
    } catch {
      payload = null
    }
  }

  const fallbackMessage = rawText.trim()

  if (!response.ok || !payload) {
    throw new Error(
      payload?.error ??
        payload?.message ??
        (fallbackMessage || `Request failed with status ${response.status}`),
    )
  }

  if (payload.data === undefined) {
    throw new Error(payload.message ?? 'Missing response payload.')
  }

  return payload.data
}

const readSessionStorage = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const value = window.sessionStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

const formatPeople = (addresses: EmailAddress[] | undefined): string => {
  if (!addresses || addresses.length === 0) {
    return 'Unknown'
  }

  return addresses
    .map((address) => address.name || address.email)
    .join(', ')
}

const formatAddress = (address: EmailAddress | undefined): string =>
  address?.name || address?.email || 'Unknown sender'

const createAgentMessage = (
  role: AgentChatMessage['role'],
  text: string,
  extras: Partial<Pick<AgentChatMessage, 'candidates' | 'command'>> = {},
): AgentChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  ...extras,
})

const upsertEmail = (currentEmails: Email[], email: Email): Email[] => {
  const nextEmails = [email, ...currentEmails.filter((item) => item.id !== email.id)]
  return nextEmails.slice(0, Math.max(currentEmails.length, 1))
}

const toStoredMatchedEmail = (email: Email): StoredMatchedEmail => ({
  id: email.id,
  threadId: email.threadId,
  subject: email.subject,
  fromLabel: formatAddress(email.from),
  date: email.date,
})

export default function Home() {
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [flashMessage, setFlashMessage] = useState('')
  const [search, setSearch] = useState('in:inbox')

  const [emails, setEmails] = useState<Email[]>([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [emailsError, setEmailsError] = useState('')
  const [selectedEmailId, setSelectedEmailId] = useState<string>('')
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [digest, setDigest] = useState('')
  const [digestLoading, setDigestLoading] = useState(false)
  const [digestError, setDigestError] = useState('')

  const [summary, setSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  const [replyTone, setReplyTone] = useState<ReplyTone>('professional')
  const [replyLength, setReplyLength] = useState<ReplyLength>('medium')
  const [replyTo, setReplyTo] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [replyDraft, setReplyDraft] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [autoReplyLoading, setAutoReplyLoading] = useState(false)
  const [sendStatus, setSendStatus] = useState('')
  const [sendError, setSendError] = useState('')
  const detailLoadOptionsRef = useRef<DetailLoadOptions | null>(null)
  const selectedEmailIdRef = useRef('')

  const [agentInput, setAgentInput] = useState('')
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentError, setAgentError] = useState('')
  const [agentMessages, setAgentMessages] =
    useState<AgentChatMessage[]>(initialAgentMessages)
  const [agentContext, setAgentContext] = useState<EmailAgentContextPayload>(
    () => readSessionStorage<EmailAgentContextPayload>(agentContextStorageKey) ?? {},
  )
  const [recentMatchedEmail, setRecentMatchedEmail] =
    useState<StoredMatchedEmail | null>(
      () => readSessionStorage<StoredMatchedEmail>(agentMatchStorageKey) ?? null,
    )

  const selectedEmailPreview = useMemo(
    () => selectedEmail?.body?.plain || selectedEmail?.snippet || '',
    [selectedEmail],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gmailStatus = params.get('gmail')
    const message = params.get('message')

    if (gmailStatus === 'connected') {
      setFlashMessage('Gmail connected successfully.')
    }

    if (gmailStatus === 'error') {
      setFlashMessage(message || 'Gmail authorization failed.')
    }

    if (gmailStatus) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    void loadSession()
  }, [])

  useEffect(() => {
    selectedEmailIdRef.current = selectedEmailId
  }, [selectedEmailId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (agentContext.lastMatchedEmailId || agentContext.lastMatchedThreadId) {
      window.sessionStorage.setItem(
        agentContextStorageKey,
        JSON.stringify(agentContext),
      )
      return
    }

    window.sessionStorage.removeItem(agentContextStorageKey)
  }, [agentContext])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (recentMatchedEmail) {
      window.sessionStorage.setItem(
        agentMatchStorageKey,
        JSON.stringify(recentMatchedEmail),
      )
      return
    }

    window.sessionStorage.removeItem(agentMatchStorageKey)
  }, [recentMatchedEmail])

  const loadSession = async () => {
    setAuthLoading(true)

    try {
      const nextSession = await fetchJson<AuthSession>('/api/auth/me')
      setSession(nextSession)
    } catch {
      setSession(null)
    } finally {
      setAuthLoading(false)
    }
  }

  const selectEmail = (emailId: string, options?: DetailLoadOptions) => {
    detailLoadOptionsRef.current = options ?? { resetAiOutputs: true }
    setSelectedEmailId(emailId)
  }

  const loadEmails = useCallback(async (query: string) => {
    setEmailsLoading(true)
    setEmailsError('')

    try {
      const payload = await fetchJson<EmailListPayload>(
        `/api/emails?limit=18&search=${encodeURIComponent(query)}`,
      )

      setEmails(payload.emails)
      const nextSelectedId =
        selectedEmailIdRef.current &&
        payload.emails.some((email) => email.id === selectedEmailIdRef.current)
          ? selectedEmailIdRef.current
          : payload.emails[0]?.id ?? ''

      if (!nextSelectedId) {
        setSelectedEmailId('')
        setSelectedEmail(null)
        return
      }

      if (nextSelectedId !== selectedEmailIdRef.current) {
        selectEmail(nextSelectedId)
      }
    } catch (error) {
      setEmailsError(error instanceof Error ? error.message : 'Failed to load inbox.')
    } finally {
      setEmailsLoading(false)
    }
  }, [])

  const loadEmailDetail = useCallback(async (emailId: string, options?: DetailLoadOptions) => {
    const shouldResetAiOutputs = options?.resetAiOutputs !== false

    setDetailLoading(true)

    if (shouldResetAiOutputs) {
      setSummary('')
      setReplyTo('')
      setReplySubject('')
      setReplyDraft('')
      setSummaryError('')
      setReplyError('')
      setSendStatus('')
      setSendError('')
    }

    try {
      const email = await fetchJson<Email>(`/api/emails/${emailId}`)
      setSelectedEmail(email)
    } catch (error) {
      setEmailsError(error instanceof Error ? error.message : 'Failed to load email.')
      setSelectedEmail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    void loadEmails('in:inbox')
  }, [session, loadEmails])

  useEffect(() => {
    if (!selectedEmailId) {
      return
    }

    const nextOptions = detailLoadOptionsRef.current
    detailLoadOptionsRef.current = null

    void loadEmailDetail(selectedEmailId, nextOptions ?? undefined)
  }, [selectedEmailId, loadEmailDetail])

  const appendAgentMessage = (message: AgentChatMessage) => {
    setAgentMessages((currentMessages) => [...currentMessages, message])
  }

  const clearAgentMemory = () => {
    setAgentContext({})
    setRecentMatchedEmail(null)
  }

  const connectGmail = () => {
    void (async () => {
      try {
        const payload = await fetchJson<{ authUrl: string; provider: string }>(
          '/api/auth/oauth/init',
        )
        window.location.href = payload.authUrl
      } catch (error) {
        setFlashMessage(
          error instanceof Error
            ? error.message
            : 'Backend is unavailable. Make sure the API server is running on port 3001.',
        )
      }
    })()
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'DELETE' })
    setSession(null)
    setEmails([])
    setSelectedEmailId('')
    setSelectedEmail(null)
    setDigest('')
    setSummary('')
    setReplyTo('')
    setReplySubject('')
    setReplyDraft('')
    setSendStatus('')
    setSendError('')
    setAgentInput('')
    setAgentError('')
    setAgentMessages(initialAgentMessages)
    clearAgentMemory()
  }

  const organizeMailbox = async () => {
    setDigestLoading(true)
    setDigestError('')

    try {
      const payload = await fetchJson<OrganizePayload>('/api/emails/organize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          search,
          unread: search.includes('is:unread') ? true : undefined,
          limit: 10,
        }),
      })

      setDigest(payload.summary)
    } catch (error) {
      setDigestError(
        error instanceof Error ? error.message : 'Failed to organize mailbox.',
      )
    } finally {
      setDigestLoading(false)
    }
  }

  const summarizeSelected = async () => {
    if (!selectedEmailId) {
      return
    }

    setSummaryLoading(true)
    setSummaryError('')

    try {
      const payload = await fetchJson<{ summary: string }>(
        `/api/emails/${selectedEmailId}/summarize`,
        {
          method: 'POST',
        },
      )

      setSummary(payload.summary)
    } catch (error) {
      setSummaryError(
        error instanceof Error ? error.message : 'Failed to summarize email.',
      )
    } finally {
      setSummaryLoading(false)
    }
  }

  const generateReply = async () => {
    if (!selectedEmailId) {
      return
    }

    setReplyLoading(true)
    setReplyError('')
    setSendStatus('')
    setSendError('')

    try {
      const payload = await fetchJson<ReplyDraftPayload>(`/api/emails/${selectedEmailId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          desiredTone: replyTone,
          desiredLength: replyLength,
        }),
      })

      setReplyTo(payload.replyDraft.to)
      setReplySubject(payload.replyDraft.subject)
      setReplyDraft(payload.replyDraft.body)
    } catch (error) {
      setReplyError(
        error instanceof Error ? error.message : 'Failed to generate reply.',
      )
    } finally {
      setReplyLoading(false)
    }
  }

  const sendDraft = async () => {
    if (!selectedEmailId || !replyDraft.trim()) {
      return
    }

    setSendLoading(true)
    setReplyError('')
    setSendError('')
    setSendStatus('')

    try {
      const payload = await fetchJson<SendReplyPayload>(
        `/api/emails/${selectedEmailId}/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: replyTo,
            subject: replySubject,
            body: replyDraft,
          }),
        },
      )

      setSendStatus(
        `Reply sent successfully${replyTo ? ` to ${replyTo}` : ''}. Message ID: ${payload.sentMessageId}`,
      )
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Failed to send reply.')
    } finally {
      setSendLoading(false)
    }
  }

  const autoReply = async () => {
    if (!selectedEmailId) {
      return
    }

    setAutoReplyLoading(true)
    setReplyError('')
    setSendError('')
    setSendStatus('')

    try {
      const payload = await fetchJson<SendReplyPayload>(
        `/api/emails/${selectedEmailId}/auto-reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            desiredTone: replyTone,
            desiredLength: replyLength,
          }),
        },
      )

      if (payload.replyDraft) {
        setReplyTo(payload.replyDraft.to)
        setReplySubject(payload.replyDraft.subject)
        setReplyDraft(payload.replyDraft.body)
      }

      setSendStatus(
        `AI reply sent successfully${payload.replyDraft?.to ? ` to ${payload.replyDraft.to}` : ''}. Message ID: ${payload.sentMessageId}`,
      )
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : 'Failed to generate and send reply.',
      )
    } finally {
      setAutoReplyLoading(false)
    }
  }

  const runEmailAgent = async (
    command: string,
    options?: {
      confirmedEmailId?: string
      userFacingMessage?: string
    },
  ) => {
    const trimmedCommand = command.trim()

    if (!trimmedCommand || agentLoading) {
      return
    }

    appendAgentMessage(
      createAgentMessage('user', options?.userFacingMessage ?? trimmedCommand),
    )

    setAgentLoading(true)
    setAgentError('')

    try {
      const payload = await fetchJson<EmailAgentResponse>('/api/emails/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmedCommand,
          context: {
            ...agentContext,
            selectedEmailId,
            ...(options?.confirmedEmailId
              ? { confirmedEmailId: options.confirmedEmailId }
              : {}),
          },
        }),
      })

      appendAgentMessage(
        createAgentMessage('assistant', payload.assistantMessage, {
          candidates: payload.candidates,
          command:
            payload.status === 'needs_disambiguation' ? trimmedCommand : undefined,
        }),
      )

      if (payload.status === 'completed') {
        if (payload.matchedEmail) {
          setSelectedEmail(payload.matchedEmail)
          setEmails((currentEmails) => upsertEmail(currentEmails, payload.matchedEmail!))
          setRecentMatchedEmail(toStoredMatchedEmail(payload.matchedEmail))
          setAgentContext(payload.context)

          if (payload.matchedEmail.id !== selectedEmailId) {
            selectEmail(payload.matchedEmail.id, { resetAiOutputs: false })
          }
        }

        if (payload.action === 'summarize') {
          setSummary(payload.summary ?? '')
          setSummaryError('')
        }

        if (payload.action === 'draft_reply' && payload.replyDraft) {
          setReplyTo(payload.replyDraft.to)
          setReplySubject(payload.replyDraft.subject)
          setReplyDraft(payload.replyDraft.body)
          setReplyError('')
          setSendStatus('')
          setSendError('')
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to run the email agent.'

      setAgentError(message)
      appendAgentMessage(createAgentMessage('assistant', message))

      if (/not authenticated|not connected|gmail account/i.test(message)) {
        setSession(null)
        clearAgentMemory()
      }
    } finally {
      setAgentLoading(false)
    }
  }

  const handleAgentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextCommand = agentInput.trim()

    if (!nextCommand) {
      return
    }

    setAgentInput('')
    void runEmailAgent(nextCommand)
  }

  const confirmAgentCandidate = (command: string, candidate: EmailAgentCandidatePayload) => {
    void runEmailAgent(command, {
      confirmedEmailId: candidate.id,
      userFacingMessage: `Use "${candidate.subject}" from ${formatAddress(candidate.from)}.`,
    })
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="inline-flex items-center gap-3 rounded-full border border-stone-900/10 bg-white/80 px-5 py-3 text-sm text-stone-700 shadow-sm">
          <LoaderCircle className="h-4 w-4 animate-spin text-orange-500" />
          Checking Gmail session...
        </div>
      </main>
    )
  }

  return (
    <main className="relative overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-stone-900/10 bg-[linear-gradient(135deg,rgba(255,248,235,0.96),rgba(255,237,210,0.9))] p-6 shadow-[0_25px_80px_rgba(75,48,22,0.12)] sm:p-8 lg:p-10">
          <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-orange-300/35 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.95fr]">
            <div className="space-y-5">
              <p className={sectionLabelClass}>TRAE x Gmail x MiniMax</p>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-5xl lg:text-6xl">
                  Connect Gmail, let MiniMax read the inbox, then summarize and triage it.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-stone-700 sm:text-lg">
                  This version no longer depends on manual copy-paste. After Gmail
                  authorization, the backend pulls real messages from the user mailbox
                  and sends them to MiniMax for summaries, reply drafting, one-click
                  sending, and inbox organization.
                </p>
              </div>

              {flashMessage ? (
                <div className="max-w-2xl rounded-2xl border border-stone-900/10 bg-white/75 px-4 py-3 text-sm text-stone-700 shadow-sm">
                  {flashMessage}
                </div>
              ) : null}

              {session ? (
                <div className="flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/80 px-4 py-2 text-sm text-stone-700 shadow-sm">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>{session.user.email}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-stone-950 px-4 py-2 text-sm text-stone-50 shadow-sm">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span>{session.mailbox.messagesTotal.toLocaleString()} messages</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.75rem] border border-stone-900/10 bg-stone-950 p-5 text-stone-50 shadow-[0_18px_60px_rgba(20,20,20,0.25)]">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                What this does
              </p>
              <div className="mt-5 space-y-4">
                {[
                  'Google OAuth signs the user into Gmail',
                  'The backend reads live inbox data with Gmail API',
                  'MiniMax summarizes one email or organizes a mailbox slice',
                  'Replies can be drafted for review or sent directly by AI',
                ].map((item, index) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-300 text-xs font-semibold text-stone-950">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-stone-200">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                {!session ? (
                  <button
                    type="button"
                    onClick={connectGmail}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-stone-950 transition hover:bg-stone-100"
                  >
                    <Mail className="h-4 w-4" />
                    Connect Gmail
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-transparent px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                  >
                    <LogOut className="h-4 w-4" />
                    Disconnect Gmail
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {!session ? (
          <section className="mt-6 rounded-[1.75rem] border border-dashed border-stone-300 bg-white/75 p-8 text-center shadow-[0_14px_40px_rgba(70,46,27,0.08)]">
            <Inbox className="mx-auto h-10 w-10 text-stone-400" />
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
              Gmail authorization required
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-stone-600">
              Click the Gmail button above. After Google redirects back, this page will
              load the real inbox and unlock email summaries and reply drafting.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-6 rounded-[1.75rem] border border-stone-900/10 bg-white/80 p-5 shadow-[0_14px_40px_rgba(70,46,27,0.08)] backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className={sectionLabelClass}>Inbox Query</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
                    Pull live messages from Gmail
                  </h2>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-full border border-stone-200 bg-stone-50/90 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400 focus:bg-white sm:min-w-[260px]"
                    placeholder="Example: in:inbox is:unread newer_than:7d"
                  />
                  <button
                    type="button"
                    onClick={() => void loadEmails(search)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Sync inbox
                  </button>
                  <button
                    type="button"
                    onClick={organizeMailbox}
                    disabled={digestLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <WandSparkles className="h-4 w-4" />
                    {digestLoading ? 'Organizing...' : 'Organize inbox'}
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                <p className={sectionLabelClass}>MiniMax mailbox digest</p>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                  {digestError || digest || 'Inbox-level summary will appear here.'}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-[1.75rem] border border-stone-900/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(244,247,240,0.86))] p-5 shadow-[0_14px_40px_rgba(70,46,27,0.08)] backdrop-blur sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className={sectionLabelClass}>Email Agent</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
                    Ask for the email you want
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                    Use natural language to find the right message, summarize it, or
                    draft a reply without manually clicking through the inbox first.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {recentMatchedEmail ? (
                    <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-stone-700 shadow-sm">
                      <p className={sectionLabelClass}>Last matched</p>
                      <p className="mt-2 font-medium text-stone-900">
                        {recentMatchedEmail.subject}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {recentMatchedEmail.fromLabel} ·{' '}
                        {dateFormatter.format(new Date(recentMatchedEmail.date))}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 px-4 py-3 text-sm text-stone-600">
                      Your last matched email will appear here for follow-up commands.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.5rem] border border-stone-200 bg-white/85 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className={sectionLabelClass}>Conversation</p>
                    {agentLoading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-emerald-600" />
                    ) : (
                      <Bot className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>

                  <div className="mt-4 max-h-[360px] space-y-3 overflow-auto pr-1">
                    {agentMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                          message.role === 'user'
                            ? 'ml-auto max-w-[92%] border border-stone-900 bg-stone-950 text-white'
                            : 'max-w-[95%] border border-stone-200 bg-stone-50/90 text-stone-700'
                        }`}
                      >
                        <p>{message.text}</p>
                        {message.candidates?.length ? (
                          <div className="mt-3 space-y-2">
                            {message.candidates.map((candidate) => (
                              <button
                                type="button"
                                key={candidate.id}
                                onClick={() =>
                                  message.command
                                    ? confirmAgentCandidate(message.command, candidate)
                                    : undefined
                                }
                                disabled={agentLoading}
                                className="flex w-full items-start justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-3 text-left text-stone-800 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <div>
                                  <p className="font-medium">{candidate.subject}</p>
                                  <p className="mt-1 text-xs text-stone-500">
                                    {formatAddress(candidate.from)}
                                  </p>
                                  <p className="mt-2 text-xs leading-5 text-stone-600">
                                    {candidate.snippet || 'No preview available.'}
                                  </p>
                                </div>
                                <span className="whitespace-nowrap text-xs text-stone-500">
                                  {dateFormatter.format(new Date(candidate.date))}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.5rem] border border-stone-200 bg-stone-950 p-4 text-stone-50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-amber-300" />
                      <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                        Prompt ideas
                      </p>
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-stone-200">
                      <p>"Summarize the pricing email Alice sent this morning."</p>
                      <p>"Draft a friendly reply to the last email you found."</p>
                      <p>"Find the unread contract message from John and summarize it."</p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleAgentSubmit}
                    className="rounded-[1.5rem] border border-stone-200 bg-white/90 p-4 shadow-sm"
                  >
                    <label className={sectionLabelClass} htmlFor="agent-command">
                      Command
                    </label>
                    <textarea
                      id="agent-command"
                      value={agentInput}
                      onChange={(event) => setAgentInput(event.target.value)}
                      placeholder="Example: Find the unread quote request from Alice and draft a short professional reply."
                      rows={6}
                      className="mt-3 w-full rounded-2xl border border-stone-200 bg-stone-50/90 px-4 py-3 text-sm leading-6 text-stone-800 outline-none transition focus:border-emerald-400 focus:bg-white"
                    />
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm leading-6 text-stone-600">
                        Agent results will populate the current summary or reply draft
                        panels automatically.
                      </p>
                      <button
                        type="submit"
                        disabled={agentLoading || !agentInput.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {agentLoading ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <SendHorizontal className="h-4 w-4" />
                        )}
                        {agentLoading ? 'Working...' : 'Run email agent'}
                      </button>
                    </div>
                    <div className="mt-3 min-h-6 whitespace-pre-wrap text-sm leading-6 text-stone-600">
                      {agentError || 'The agent will ask for confirmation only when several emails are close matches.'}
                    </div>
                  </form>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              <article className="rounded-[1.75rem] border border-stone-900/10 bg-white/80 p-5 shadow-[0_14px_40px_rgba(70,46,27,0.08)] backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={sectionLabelClass}>Inbox</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
                      Gmail messages
                    </h2>
                  </div>
                  {emailsLoading ? (
                    <LoaderCircle className="h-5 w-5 animate-spin text-orange-500" />
                  ) : (
                    <Inbox className="h-5 w-5 text-orange-500" />
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  {emailsError ? (
                    <div className="rounded-2xl border border-rose-300/70 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
                      {emailsError}
                    </div>
                  ) : null}

                  {emails.map((email) => (
                    <button
                      type="button"
                      key={email.id}
                      onClick={() => selectEmail(email.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        selectedEmailId === email.id
                          ? 'border-stone-950 bg-stone-950 text-white shadow-[0_16px_30px_rgba(26,26,26,0.15)]'
                          : 'border-stone-200 bg-stone-50/80 text-stone-900 hover:border-orange-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold leading-6">
                            {email.subject}
                          </p>
                          <p
                            className={`mt-1 text-xs ${
                              selectedEmailId === email.id
                                ? 'text-stone-300'
                                : 'text-stone-500'
                            }`}
                          >
                            {email.from.name || email.from.email}
                          </p>
                        </div>
                        <p
                          className={`whitespace-nowrap text-xs ${
                            selectedEmailId === email.id
                              ? 'text-stone-300'
                              : 'text-stone-500'
                          }`}
                        >
                          {dateFormatter.format(new Date(email.date))}
                        </p>
                      </div>
                      <p
                        className={`mt-3 line-clamp-3 text-sm leading-6 ${
                          selectedEmailId === email.id
                            ? 'text-stone-200'
                            : 'text-stone-600'
                        }`}
                      >
                        {email.snippet || 'No preview available.'}
                      </p>
                    </button>
                  ))}

                  {!emailsLoading && emails.length === 0 && !emailsError ? (
                    <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
                      No messages matched this query.
                    </div>
                  ) : null}
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-stone-900/10 bg-white/80 p-5 shadow-[0_14px_40px_rgba(70,46,27,0.08)] backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={sectionLabelClass}>Selected Email</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
                      Read and act with MiniMax
                    </h2>
                  </div>
                  {detailLoading ? (
                    <LoaderCircle className="h-5 w-5 animate-spin text-orange-500" />
                  ) : (
                    <Mail className="h-5 w-5 text-emerald-600" />
                  )}
                </div>

                {selectedEmail ? (
                  <div className="mt-5 space-y-5">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-stone-950">
                        {selectedEmail.subject}
                      </h3>
                      <div className="mt-3 grid gap-2 text-sm text-stone-600">
                        <p>
                          <span className="font-medium text-stone-900">From:</span>{' '}
                          {selectedEmail.from.name || selectedEmail.from.email}
                        </p>
                        <p>
                          <span className="font-medium text-stone-900">To:</span>{' '}
                          {formatPeople(selectedEmail.to)}
                        </p>
                        <p>
                          <span className="font-medium text-stone-900">Date:</span>{' '}
                          {dateFormatter.format(new Date(selectedEmail.date))}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <p className={sectionLabelClass}>Body</p>
                      <div className="mt-3 max-h-[280px] overflow-auto whitespace-pre-wrap text-sm leading-7 text-stone-700">
                        {selectedEmailPreview || 'No email body was extracted.'}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className={sectionLabelClass}>Summary</p>
                          <button
                            type="button"
                            onClick={summarizeSelected}
                            disabled={summaryLoading}
                            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {summaryLoading ? 'Working...' : 'Summarize'}
                          </button>
                        </div>
                        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                          {summaryError || summary || 'MiniMax summary will appear here.'}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className={sectionLabelClass}>Reply Draft</p>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={generateReply}
                              disabled={replyLoading || autoReplyLoading}
                              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {replyLoading ? 'Working...' : 'Draft reply'}
                            </button>
                            <button
                              type="button"
                              onClick={autoReply}
                              disabled={replyLoading || autoReplyLoading}
                              className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {autoReplyLoading ? 'Sending...' : 'AI send now'}
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <select
                            value={replyTone}
                            onChange={(event) => setReplyTone(event.target.value as ReplyTone)}
                            className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none"
                          >
                            <option value="professional">Professional</option>
                            <option value="friendly">Friendly</option>
                            <option value="formal">Formal</option>
                            <option value="casual">Casual</option>
                          </select>
                          <select
                            value={replyLength}
                            onChange={(event) =>
                              setReplyLength(event.target.value as ReplyLength)
                            }
                            className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none"
                          >
                            <option value="short">Short</option>
                            <option value="medium">Medium</option>
                            <option value="long">Long</option>
                          </select>
                        </div>

                        <div className="mt-3 space-y-3">
                          <input
                            value={replyTo}
                            onChange={(event) => setReplyTo(event.target.value)}
                            placeholder="Recipient email"
                            className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-emerald-400"
                          />
                          <input
                            value={replySubject}
                            onChange={(event) => setReplySubject(event.target.value)}
                            placeholder="Subject"
                            className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-emerald-400"
                          />
                          <textarea
                            value={replyDraft}
                            onChange={(event) => setReplyDraft(event.target.value)}
                            placeholder="MiniMax reply draft will appear here."
                            rows={10}
                            className="min-h-[220px] w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm leading-6 text-stone-700 outline-none transition focus:border-emerald-400"
                          />
                          <button
                            type="button"
                            onClick={sendDraft}
                            disabled={sendLoading || autoReplyLoading || !replyDraft.trim()}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {sendLoading ? 'Sending...' : 'Send draft'}
                          </button>
                          <div className="whitespace-pre-wrap text-sm leading-6 text-stone-700">
                            {replyError ||
                              sendError ||
                              sendStatus ||
                              'Generate a draft, edit it if needed, or use AI send now for one-click sending.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500">
                    Select a Gmail message from the left side to view details and run AI
                    actions.
                  </div>
                )}
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { mailApi } from '../api'
import type {
  AuthSession,
  Email,
  ReplyLength,
  ReplyTone,
} from '../types'
import { getEmailPreviewText } from '../utils'

const DEFAULT_QUERY = 'in:inbox'

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

export function useMailWorkspace() {
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [flashMessage, setFlashMessage] = useState('')
  const [search, setSearch] = useState(DEFAULT_QUERY)

  const [emails, setEmails] = useState<Email[]>([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [emailsError, setEmailsError] = useState('')
  const [selectedEmailId, setSelectedEmailId] = useState('')
  const selectedEmailIdRef = useRef('')
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

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

  const clearEmailActions = useCallback((resetComposerPreferences: boolean = false) => {
    setSummary('')
    setSummaryError('')
    setReplyTo('')
    setReplySubject('')
    setReplyDraft('')
    setReplyError('')
    setSendStatus('')
    setSendError('')

    if (resetComposerPreferences) {
      setReplyTone('professional')
      setReplyLength('medium')
    }
  }, [])

  const clearSelectedEmail = useCallback(() => {
    setSelectedEmailId('')
    setSelectedEmail(null)
    setDetailError('')
    clearEmailActions()
  }, [clearEmailActions])

  const loadSession = useCallback(async () => {
    setAuthLoading(true)

    try {
      const nextSession = await mailApi.getSession()
      setSession(nextSession)
    } catch {
      setSession(null)
      setEmails([])
      clearSelectedEmail()
    } finally {
      setAuthLoading(false)
    }
  }, [clearSelectedEmail])

  const loadEmails = useCallback(async (query: string) => {
    setEmailsLoading(true)
    setEmailsError('')

    try {
      const payload = await mailApi.listEmails(query)
      const nextSelectedEmailId = payload.emails.some(
        (email) => email.id === selectedEmailIdRef.current,
      )
        ? selectedEmailIdRef.current
        : payload.emails[0]?.id ?? ''

      setEmails(payload.emails)
      setSelectedEmailId(nextSelectedEmailId)

      if (!nextSelectedEmailId) {
        setSelectedEmail(null)
        setDetailError('')
        clearEmailActions()
      }
    } catch (error) {
      setEmailsError(error instanceof Error ? error.message : 'Failed to load inbox.')
    } finally {
      setEmailsLoading(false)
    }
  }, [clearEmailActions])

  const loadEmailDetail = useCallback(async (emailId: string) => {
    setDetailLoading(true)
    setDetailError('')
    clearEmailActions()

    try {
      const email = await mailApi.getEmail(emailId)
      setSelectedEmail(email)
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Failed to load email.')
      setSelectedEmail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [clearEmailActions])

  useEffect(() => {
    selectedEmailIdRef.current = selectedEmailId
  }, [selectedEmailId])

  useEffect(() => {
    setFlashMessage(getRedirectFlashMessage())
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    if (!session) {
      return
    }

    void loadEmails(DEFAULT_QUERY)
  }, [loadEmails, session])

  useEffect(() => {
    if (!selectedEmailId) {
      return
    }

    void loadEmailDetail(selectedEmailId)
  }, [loadEmailDetail, selectedEmailId])

  const connectGmail = async () => {
    try {
      const payload = await mailApi.initOAuth()
      window.location.href = payload.authUrl
    } catch (error) {
      setFlashMessage(
        error instanceof Error
          ? error.message
          : 'Backend is unavailable. Make sure the API server is running on port 3001.',
      )
    }
  }

  const logout = async () => {
    await mailApi.logout()
    setSession(null)
    setEmails([])
    setDigest('')
    setDigestError('')
    clearSelectedEmail()
    clearEmailActions(true)
  }

  const organizeMailbox = async () => {
    setDigestLoading(true)
    setDigestError('')

    try {
      const payload = await mailApi.organizeMailbox(search)
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
      const payload = await mailApi.summarizeEmail(selectedEmailId)
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
      const payload = await mailApi.generateReply(
        selectedEmailId,
        replyTone,
        replyLength,
      )

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
      const payload = await mailApi.sendReply(selectedEmailId, {
        to: replyTo,
        subject: replySubject,
        body: replyDraft,
      })

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
      const payload = await mailApi.autoReply(selectedEmailId, replyTone, replyLength)

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

  return {
    authLoading,
    session,
    flashMessage,
    search,
    setSearch,
    emails,
    emailsLoading,
    emailsError,
    selectedEmailId,
    setSelectedEmailId,
    selectedEmail,
    selectedEmailPreview: getEmailPreviewText(selectedEmail),
    detailLoading,
    detailError,
    digest,
    digestLoading,
    digestError,
    summary,
    summaryLoading,
    summaryError,
    replyTone,
    setReplyTone,
    replyLength,
    setReplyLength,
    replyTo,
    setReplyTo,
    replySubject,
    setReplySubject,
    replyDraft,
    setReplyDraft,
    replyLoading,
    replyError,
    sendLoading,
    autoReplyLoading,
    sendStatus,
    sendError,
    connectGmail,
    logout,
    syncInbox: () => loadEmails(search),
    organizeMailbox,
    summarizeSelected,
    generateReply,
    sendDraft,
    autoReply,
  }
}

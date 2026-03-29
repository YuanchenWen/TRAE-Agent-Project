import {
  ArrowDown,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  LogOut,
  Mail,
  Plus,
  Power,
  SendHorizonal,
  Sparkles,
} from 'lucide-react'
import { useAgentI18n } from '../i18n'
import type {
  AgentArtifact,
  AgentResponse,
  AgentToolStep,
  AgentViewState,
  ChatMessage,
} from '../types'

const windowActionDots = ['#ff5f57', '#febc2e', '#28c840']

function ToolStepCard({
  step,
}: {
  step: AgentToolStep
}) {
  const { localizeToolLabel } = useAgentI18n()

  return (
    <div className="flex items-center justify-between rounded-[1.15rem] border border-stone-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
          <Mail className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[1.02rem] font-medium text-stone-700">
            {localizeToolLabel(step.label)}
          </p>
          {step.detail ? (
            <p className="text-sm text-stone-400">{step.detail}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <CircleAlert className="h-5 w-5 text-stone-400" />
        {step.status === 'completed' ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <CircleAlert className="h-5 w-5 text-rose-500" />
        )}
      </div>
    </div>
  )
}

function EmailSummaryArtifact({
  artifact,
}: {
  artifact: Extract<AgentArtifact, { type: 'email_summary' }>
}) {
  const { t } = useAgentI18n()

  return (
    <div className="space-y-5 border-t border-b border-stone-200 py-5">
      <div className="space-y-2 text-stone-900">
        <p className="text-[1.05rem] font-semibold">{t('ui.emailSummaryTitle')}</p>
        <p className="text-[1.02rem]">
          <span className="font-semibold">{t('ui.sender')}：</span>{' '}
          <span className="text-sky-600 underline decoration-sky-200 underline-offset-4">
            {artifact.from}
          </span>
        </p>
        <p className="text-[1.02rem]">
          <span className="font-semibold">{t('ui.subject')}：</span> {artifact.subject}
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[1.02rem] font-semibold text-stone-900">{t('ui.summary')}：</p>
        <p className="text-[1rem] leading-8 text-stone-700">{artifact.summary}</p>
        {artifact.bullets.length > 0 ? (
          <ul className="space-y-3 pl-6 text-[1rem] leading-8 text-stone-800">
            {artifact.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

function EmailListArtifact({
  artifact,
}: {
  artifact: Extract<AgentArtifact, { type: 'email_list' }>
}) {
  const { t } = useAgentI18n()

  return (
    <div className="space-y-4 border-t border-b border-stone-200 py-5">
      <p className="text-[1.05rem] font-semibold text-stone-900">{artifact.title}</p>
      <div className="space-y-3">
        {artifact.emails.map((email, index) => (
          <div
            key={email.id}
            className="rounded-[1rem] border border-stone-200 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-stone-500">
                  {index + 1}. {email.from}
                </p>
                <p className="text-[1.02rem] font-semibold text-stone-900">
                  {email.subject}
                </p>
              </div>
              <span className="shrink-0 text-sm text-stone-400">{email.date}</span>
            </div>
            <p className="mt-3 text-[0.98rem] leading-7 text-stone-600">
              {email.snippet || t('ui.noSummary')}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReplyDraftArtifact({
  artifact,
}: {
  artifact: Extract<AgentArtifact, { type: 'reply_draft' }>
}) {
  const { t } = useAgentI18n()

  return (
    <div className="space-y-4 border-b border-stone-200 pb-5">
      <p className="text-[1.02rem] text-stone-900">
        {t('ui.replyDraftIntro')}
      </p>
      <div className="space-y-4">
        <p className="text-[1.02rem] font-semibold text-stone-700">
          {t('ui.subject')}: <span className="font-medium text-stone-500">{artifact.subject}</span>
        </p>
        <div className="border-l-4 border-stone-300 pl-4 text-[1.05rem] leading-9 text-stone-500">
          {artifact.body.split('\n').map((line, index) => (
            <p key={`${line}-${index}`}>{line || '\u00a0'}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

function SendResultArtifact({
  artifact,
}: {
  artifact: Extract<AgentArtifact, { type: 'send_result' }>
}) {
  const { t } = useAgentI18n()

  return (
    <div className="space-y-4">
      <p className="text-[1.1rem] font-semibold text-stone-900">{t('ui.replySentTitle')}</p>
      <ul className="space-y-3 pl-6 text-[1rem] leading-8 text-stone-800">
        <li>
          <span className="font-semibold">{t('ui.sentTo')}：</span>{' '}
          <span className="text-sky-600 underline decoration-sky-200 underline-offset-4">
            {artifact.to}
          </span>
        </li>
        <li>
          <span className="font-semibold">{t('ui.senderAccount')}：</span>{' '}
          <span className="text-sky-600 underline decoration-sky-200 underline-offset-4">
            {artifact.from}
          </span>
        </li>
        <li>
          <span className="font-semibold">{t('ui.subject')}：</span> {artifact.subject}
        </li>
      </ul>
    </div>
  )
}

function AssistantArtifacts({
  response,
}: {
  response: AgentResponse
}) {
  return (
    <div className="space-y-5">
      {response.artifacts.map((artifact, index) => {
        if (artifact.type === 'email_list') {
          return <EmailListArtifact key={`list-${index}`} artifact={artifact} />
        }

        if (artifact.type === 'email_summary') {
          return <EmailSummaryArtifact key={`summary-${index}`} artifact={artifact} />
        }

        if (artifact.type === 'reply_draft') {
          return <ReplyDraftArtifact key={`draft-${index}`} artifact={artifact} />
        }

        return <SendResultArtifact key={`send-${index}`} artifact={artifact} />
      })}
    </div>
  )
}

function AssistantMessage({
  message,
}: {
  message: ChatMessage
}) {
  const { t } = useAgentI18n()
  const response = message.response

  return (
    <div className="flex items-start gap-4">
      <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-950 text-white shadow-[0_12px_26px_rgba(15,23,42,0.16)]">
        <Sparkles className="h-5 w-5 text-rose-400" />
      </div>

      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between rounded-[1.2rem] border border-stone-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              {message.loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>
            <span className="text-[1.02rem] font-medium text-stone-700">
              {t('ui.thoughtProcess')}
            </span>
            <ChevronRight className="h-4 w-4 text-stone-400" />
          </div>
          {message.loading ? (
            <LoaderCircle className="h-5 w-5 animate-spin text-stone-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          )}
        </div>

        {response ? (
          <>
            <p className="text-[1.28rem] font-semibold leading-9 text-stone-900">
              {response.intro}
            </p>
            <div className="space-y-3">
              {response.steps.map((step) => (
                <ToolStepCard key={`${step.label}-${step.detail ?? ''}`} step={step} />
              ))}
            </div>
            <AssistantArtifacts response={response} />
            <p className="text-[1.05rem] leading-8 text-stone-900">{response.prompt}</p>
          </>
        ) : (
          <p className="text-[1.02rem] leading-8 text-stone-700">{message.content}</p>
        )}
      </div>
    </div>
  )
}

function UserMessage({
  message,
}: {
  message: ChatMessage
}) {
  const { t } = useAgentI18n()

  return (
    <div className="flex items-start gap-4">
      <div className="mt-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#4f8cff,#8ed1ff)] text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,140,255,0.28)]">
        {t('ui.you')}
      </div>
      <div className="max-w-[88%] rounded-[1.6rem] bg-stone-100 px-5 py-4 text-[1.05rem] leading-8 text-stone-600 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        {message.content}
      </div>
    </div>
  )
}

function EmptyState({
  onConnectGmail,
}: {
  onConnectGmail: () => void | Promise<void>
}) {
  const { t } = useAgentI18n()

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600">
        <Mail className="h-8 w-8" />
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-stone-900">
          {t('ui.connectGmailFirst')}
        </h2>
        <p className="text-[1.05rem] leading-8 text-stone-500">
          {t('ui.connectGmailDescription')}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void onConnectGmail()}
        className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
      >
        <Mail className="h-4 w-4" />
        {t('ui.connectGmail')}
      </button>
    </div>
  )
}

export function AgentChatWindow({
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
  onComposerChange,
  onSubmit,
  onConnectGmail,
  onLogout,
  onActivateAgentSession,
}: AgentViewState) {
  const { locale, setLocale, t } = useAgentI18n()

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="inline-flex items-center gap-3 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm text-stone-700 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
          <LoaderCircle className="h-4 w-4 animate-spin text-sky-500" />
          {t('ui.checkingGmailSession')}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(246,244,240,0.98)_42%,rgba(239,235,227,1))] px-5 py-8 text-stone-900 sm:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="relative overflow-hidden rounded-[2.4rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,248,244,0.96))] shadow-[0_40px_120px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88),transparent_36%)]" />

          <div className="relative flex items-center justify-between border-b border-stone-200/70 px-6 py-5">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                {windowActionDots.map((color) => (
                  <span
                    key={color}
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <Bot className="h-5 w-5 text-stone-500" />
              </div>
            </div>

            <div className="rounded-full bg-white/90 px-6 py-3 text-[1.05rem] font-semibold text-stone-900 shadow-[0_14px_34px_rgba(15,23,42,0.1)]">
              {threadTitle}
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-stone-200 bg-white p-1 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <button
                  type="button"
                  onClick={() => setLocale('zh-CN')}
                  className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                    locale === 'zh-CN'
                      ? 'bg-stone-950 text-white'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                  aria-label={`${t('ui.language')}: 中文`}
                >
                  中文
                </button>
                <button
                  type="button"
                  onClick={() => setLocale('en-US')}
                  className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                    locale === 'en-US'
                      ? 'bg-stone-950 text-white'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                  aria-label={`${t('ui.language')}: English`}
                >
                  EN
                </button>
              </div>
              {session ? (
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-stone-500 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:text-stone-900"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : null}
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-stone-600 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <Plus className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[calc(100vh-11rem)] flex-col">
            <div className="flex-1 overflow-y-auto px-8 pb-8 pt-7 sm:px-10">
              {flashMessage ? (
                <div className="mb-6 rounded-[1.1rem] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  {flashMessage}
                </div>
              ) : null}

              {session ? (
                <div className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center gap-3 rounded-[1.3rem] border border-stone-200 bg-white px-4 py-4 text-sm text-stone-600 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <span>
                    {t('ui.gmail')}: <strong>{session.user.email}</strong>
                  </span>
                  <span>
                    {t('ui.agentSession')}:{' '}
                    <strong>{agentSessionStatus?.active ? agentSessionStatus.email : t('ui.inactive')}</strong>
                  </span>
                  <span>
                    {t('ui.imessageBridge')}:{' '}
                    <strong>
                      {bridgeStatus
                        ? bridgeStatus.enabled
                          ? bridgeStatus.started
                            ? t('ui.running')
                            : t('ui.configured')
                          : t('ui.disabled')
                        : t('ui.unknown')}
                    </strong>
                  </span>
                  {bridgeStatus ? (
                    <span>
                      {t('ui.trigger')}: <strong>{bridgeStatus.triggerPrefix}</strong>
                    </span>
                  ) : null}
                  {bridgeStatus?.lastError ? (
                    <span className="text-rose-600">
                      {t('ui.imessageError')}: <strong>{bridgeStatus.lastError}</strong>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onActivateAgentSession()}
                    disabled={activatingAgentSession}
                    className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    {activatingAgentSession ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                    {t('ui.activateForIMessage')}
                  </button>
                </div>
              ) : null}

              {session ? (
                <div className="mx-auto flex max-w-5xl flex-col gap-8">
                  {messages.map((message) =>
                    message.role === 'user' ? (
                      <UserMessage key={message.id} message={message} />
                    ) : (
                      <AssistantMessage key={message.id} message={message} />
                    ),
                  )}
                </div>
              ) : (
                <EmptyState onConnectGmail={onConnectGmail} />
              )}
            </div>

            <div className="border-t border-stone-200/80 bg-white/85 px-6 py-5 backdrop-blur sm:px-8">
              <div className="mx-auto flex max-w-5xl items-end gap-4">
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition hover:text-stone-900"
                >
                  <Plus className="h-4 w-4" />
                </button>

                <div className="flex-1 rounded-[1.7rem] border border-stone-200 bg-[linear-gradient(180deg,#ffffff,#f5f2eb)] px-5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                  <textarea
                    value={composerValue}
                    onChange={(event) => onComposerChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void onSubmit()
                      }
                    }}
                    placeholder={
                      session
                        ? t('ui.askInboxPlaceholder')
                        : t('ui.connectPlaceholder')
                    }
                    rows={2}
                    className="min-h-[56px] w-full resize-none bg-transparent text-[1.02rem] leading-8 text-stone-700 outline-none placeholder:text-stone-400"
                    disabled={!session || sending}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void onSubmit()}
                  disabled={!session || sending || !composerValue.trim()}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-stone-950 text-white shadow-[0_18px_36px_rgba(15,23,42,0.16)] transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {sending ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <SendHorizonal className="h-5 w-5" />
                  )}
                </button>
              </div>

              <div className="mx-auto mt-3 flex max-w-5xl items-center justify-between px-2 text-sm text-stone-400">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-500" />
                  <span>
                    {session
                      ? t('ui.connectedAs', { email: session.user.email })
                      : t('ui.agentIdle')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{t('ui.submit')}</span>
                  <ArrowDown className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

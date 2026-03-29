import {
  LoaderCircle,
  Mail,
} from 'lucide-react'
import type {
  Email,
  ReplyLength,
  ReplyTone,
} from '../types'
import {
  dateFormatter,
  formatPeople,
  sectionLabelClass,
} from '../utils'

interface SelectedEmailPanelProps {
  selectedEmail: Email | null
  selectedEmailPreview: string
  detailLoading: boolean
  detailError: string
  summary: string
  summaryLoading: boolean
  summaryError: string
  onSummarize: () => void | Promise<void>
  replyTone: ReplyTone
  onReplyToneChange: (tone: ReplyTone) => void
  replyLength: ReplyLength
  onReplyLengthChange: (length: ReplyLength) => void
  replyTo: string
  onReplyToChange: (value: string) => void
  replySubject: string
  onReplySubjectChange: (value: string) => void
  replyDraft: string
  onReplyDraftChange: (value: string) => void
  replyLoading: boolean
  replyError: string
  sendLoading: boolean
  autoReplyLoading: boolean
  sendStatus: string
  sendError: string
  onGenerateReply: () => void | Promise<void>
  onAutoReply: () => void | Promise<void>
  onSendDraft: () => void | Promise<void>
}

function SummaryCard({
  summary,
  summaryLoading,
  summaryError,
  onSummarize,
}: {
  summary: string
  summaryLoading: boolean
  summaryError: string
  onSummarize: () => void | Promise<void>
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className={sectionLabelClass}>Summary</p>
        <button
          type="button"
          onClick={() => void onSummarize()}
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
  )
}

function ReplyComposerCard({
  replyTone,
  onReplyToneChange,
  replyLength,
  onReplyLengthChange,
  replyTo,
  onReplyToChange,
  replySubject,
  onReplySubjectChange,
  replyDraft,
  onReplyDraftChange,
  replyLoading,
  replyError,
  sendLoading,
  autoReplyLoading,
  sendStatus,
  sendError,
  onGenerateReply,
  onAutoReply,
  onSendDraft,
}: Omit<
  SelectedEmailPanelProps,
  | 'selectedEmail'
  | 'selectedEmailPreview'
  | 'detailLoading'
  | 'detailError'
  | 'summary'
  | 'summaryLoading'
  | 'summaryError'
  | 'onSummarize'
>) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className={sectionLabelClass}>Reply Draft</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void onGenerateReply()}
            disabled={replyLoading || autoReplyLoading}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {replyLoading ? 'Working...' : 'Draft reply'}
          </button>
          <button
            type="button"
            onClick={() => void onAutoReply()}
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
          onChange={(event) => onReplyToneChange(event.target.value as ReplyTone)}
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
            onReplyLengthChange(event.target.value as ReplyLength)
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
          onChange={(event) => onReplyToChange(event.target.value)}
          placeholder="Recipient email"
          className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-emerald-400"
        />
        <input
          value={replySubject}
          onChange={(event) => onReplySubjectChange(event.target.value)}
          placeholder="Subject"
          className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-emerald-400"
        />
        <textarea
          value={replyDraft}
          onChange={(event) => onReplyDraftChange(event.target.value)}
          placeholder="MiniMax reply draft will appear here."
          rows={10}
          className="min-h-[220px] w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm leading-6 text-stone-700 outline-none transition focus:border-emerald-400"
        />
        <button
          type="button"
          onClick={() => void onSendDraft()}
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
  )
}

export function SelectedEmailPanel({
  selectedEmail,
  selectedEmailPreview,
  detailLoading,
  detailError,
  summary,
  summaryLoading,
  summaryError,
  onSummarize,
  replyTone,
  onReplyToneChange,
  replyLength,
  onReplyLengthChange,
  replyTo,
  onReplyToChange,
  replySubject,
  onReplySubjectChange,
  replyDraft,
  onReplyDraftChange,
  replyLoading,
  replyError,
  sendLoading,
  autoReplyLoading,
  sendStatus,
  sendError,
  onGenerateReply,
  onAutoReply,
  onSendDraft,
}: SelectedEmailPanelProps) {
  return (
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

      {detailError ? (
        <div className="mt-5 rounded-2xl border border-rose-300/70 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
          {detailError}
        </div>
      ) : null}

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
            <SummaryCard
              summary={summary}
              summaryLoading={summaryLoading}
              summaryError={summaryError}
              onSummarize={onSummarize}
            />
            <ReplyComposerCard
              replyTone={replyTone}
              onReplyToneChange={onReplyToneChange}
              replyLength={replyLength}
              onReplyLengthChange={onReplyLengthChange}
              replyTo={replyTo}
              onReplyToChange={onReplyToChange}
              replySubject={replySubject}
              onReplySubjectChange={onReplySubjectChange}
              replyDraft={replyDraft}
              onReplyDraftChange={onReplyDraftChange}
              replyLoading={replyLoading}
              replyError={replyError}
              sendLoading={sendLoading}
              autoReplyLoading={autoReplyLoading}
              sendStatus={sendStatus}
              sendError={sendError}
              onGenerateReply={onGenerateReply}
              onAutoReply={onAutoReply}
              onSendDraft={onSendDraft}
            />
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500">
          Select a Gmail message from the left side to view details and run AI
          actions.
        </div>
      )}
    </article>
  )
}

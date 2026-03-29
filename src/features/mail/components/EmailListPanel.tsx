import {
  Inbox,
  LoaderCircle,
} from 'lucide-react'
import type { Email } from '../types'
import {
  dateFormatter,
  sectionLabelClass,
} from '../utils'

interface EmailListPanelProps {
  emails: Email[]
  emailsLoading: boolean
  emailsError: string
  selectedEmailId: string
  onSelectEmail: (emailId: string) => void
}

export function EmailListPanel({
  emails,
  emailsLoading,
  emailsError,
  selectedEmailId,
  onSelectEmail,
}: EmailListPanelProps) {
  return (
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
            onClick={() => onSelectEmail(email.id)}
            className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
              selectedEmailId === email.id
                ? 'border-stone-950 bg-stone-950 text-white shadow-[0_16px_30px_rgba(26,26,26,0.15)]'
                : 'border-stone-200 bg-stone-50/80 text-stone-900 hover:border-orange-300 hover:bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold leading-6">{email.subject}</p>
                <p
                  className={`mt-1 text-xs ${
                    selectedEmailId === email.id ? 'text-stone-300' : 'text-stone-500'
                  }`}
                >
                  {email.from.name || email.from.email}
                </p>
              </div>
              <p
                className={`whitespace-nowrap text-xs ${
                  selectedEmailId === email.id ? 'text-stone-300' : 'text-stone-500'
                }`}
              >
                {dateFormatter.format(new Date(email.date))}
              </p>
            </div>
            <p
              className={`mt-3 line-clamp-3 text-sm leading-6 ${
                selectedEmailId === email.id ? 'text-stone-200' : 'text-stone-600'
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
  )
}

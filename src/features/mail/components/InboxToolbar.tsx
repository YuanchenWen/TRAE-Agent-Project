import {
  RefreshCw,
  WandSparkles,
} from 'lucide-react'
import { sectionLabelClass } from '../utils'

interface InboxToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  onSyncInbox: () => void | Promise<void>
  onOrganizeMailbox: () => void | Promise<void>
  digest: string
  digestLoading: boolean
  digestError: string
}

export function InboxToolbar({
  search,
  onSearchChange,
  onSyncInbox,
  onOrganizeMailbox,
  digest,
  digestLoading,
  digestError,
}: InboxToolbarProps) {
  return (
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
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full rounded-full border border-stone-200 bg-stone-50/90 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400 focus:bg-white sm:min-w-[260px]"
            placeholder="Example: in:inbox is:unread newer_than:7d"
          />
          <button
            type="button"
            onClick={() => void onSyncInbox()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            <RefreshCw className="h-4 w-4" />
            Sync inbox
          </button>
          <button
            type="button"
            onClick={() => void onOrganizeMailbox()}
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
  )
}

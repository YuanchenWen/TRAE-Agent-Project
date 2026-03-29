import {
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { AuthSession } from '../types'
import { sectionLabelClass } from '../utils'

interface MailHeroProps {
  session: AuthSession | null
  flashMessage: string
  onConnectGmail: () => void | Promise<void>
  onLogout: () => void | Promise<void>
}

export function MailHero({
  session,
  flashMessage,
  onConnectGmail,
  onLogout,
}: MailHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-stone-900/10 bg-[linear-gradient(135deg,rgba(255,248,235,0.96),rgba(255,237,210,0.9))] p-6 shadow-[0_25px_80px_rgba(75,48,22,0.12)] sm:p-8 lg:p-10">
      <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-orange-300/35 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-5">
          <p className={sectionLabelClass}>TRAE x Gmail x MiniMax</p>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-5xl lg:text-6xl">
              Turn the inbox into an agent workspace before we evolve it into a full
              chat-style mail assistant.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-stone-700 sm:text-lg">
              This pass keeps the current Gmail workflow working, but reorganizes the
              code so the next round can move toward the conversational request,
              draft, confirm, and send experience you showed.
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
                onClick={() => void onConnectGmail()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-stone-950 transition hover:bg-stone-100"
              >
                <Mail className="h-4 w-4" />
                Connect Gmail
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onLogout()}
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
  )
}

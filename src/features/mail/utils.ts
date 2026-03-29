import type {
  Email,
  EmailAddress,
} from './types'

export const sectionLabelClass =
  'text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-stone-500'

export const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export const formatPeople = (addresses: EmailAddress[] | undefined): string => {
  if (!addresses || addresses.length === 0) {
    return 'Unknown'
  }

  return addresses.map((address) => address.name || address.email).join(', ')
}

export const htmlToText = (value: string | undefined): string =>
  (value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()

export const getEmailPreviewText = (email: Email | null): string =>
  email?.body?.plain || htmlToText(email?.body?.html) || email?.snippet || ''

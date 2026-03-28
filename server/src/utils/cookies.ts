import crypto from 'crypto'

interface CookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
  path?: string
  maxAge?: number
  expires?: Date
}

const base64UrlEncode = (value: Buffer): string =>
  value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const base64UrlDecode = (value: string): Buffer => {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/')
  const paddingLength = (4 - (normalizedValue.length % 4)) % 4
  return Buffer.from(normalizedValue + '='.repeat(paddingLength), 'base64')
}

const getCipherKey = (secret: string): Buffer =>
  crypto.createHash('sha256').update(secret).digest()

export const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) {
    return {}
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, cookie) => {
    const [rawName, ...rawValue] = cookie.trim().split('=')

    if (!rawName) {
      return acc
    }

    acc[decodeURIComponent(rawName)] = decodeURIComponent(rawValue.join('='))
    return acc
  }, {})
}

export const serializeCookie = (
  name: string,
  value: string,
  options: CookieOptions = {},
): string => {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`]

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`)
  }

  parts.push(`Path=${options.path ?? '/'}`)

  if (options.httpOnly !== false) {
    parts.push('HttpOnly')
  }

  if (options.secure) {
    parts.push('Secure')
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`)
  }

  return parts.join('; ')
}

export const sealCookieValue = <T>(value: T, secret: string): string => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getCipherKey(secret), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [iv, encrypted, authTag].map(base64UrlEncode).join('.')
}

export const unsealCookieValue = <T>(value: string, secret: string): T | null => {
  try {
    const [ivPart, encryptedPart, authTagPart] = value.split('.')

    if (!ivPart || !encryptedPart || !authTagPart) {
      return null
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getCipherKey(secret),
      base64UrlDecode(ivPart),
    )

    decipher.setAuthTag(base64UrlDecode(authTagPart))

    const decrypted = Buffer.concat([
      decipher.update(base64UrlDecode(encryptedPart)),
      decipher.final(),
    ])

    return JSON.parse(decrypted.toString('utf8')) as T
  } catch {
    return null
  }
}

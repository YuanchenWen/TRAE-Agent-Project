import dotenv from 'dotenv'

dotenv.config()

const getEnv = (name: string): string | undefined => {
  const value = process.env[name]
  if (!value) {
    return undefined
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback
  }

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

const normalizeAnthropicBaseUrl = (value: string | undefined): string => {
  const rawValue = value ?? 'https://api.minimax.io/anthropic'
  const normalizedValue = rawValue.replace(/\/+$/, '')

  return normalizedValue.endsWith('/v1')
    ? normalizedValue
    : `${normalizedValue}/v1`
}

export const config = {
  port: toNumber(getEnv('PORT'), 3001),
  nodeEnv: getEnv('NODE_ENV') ?? 'development',
  jwtSecret: getEnv('JWT_SECRET'),
  sessionSecret: getEnv('SESSION_SECRET'),
  clientUrl: getEnv('CLIENT_URL') ?? 'http://localhost:5173',
  gmail: {
    clientId: getEnv('GMAIL_CLIENT_ID') ?? '',
    clientSecret: getEnv('GMAIL_CLIENT_SECRET') ?? '',
    redirectUri: getEnv('GMAIL_REDIRECT_URI') ?? '',
  },
  minimax: {
    apiKey: getEnv('MINIMAX_API_KEY') ?? getEnv('ANTHROPIC_AUTH_TOKEN') ?? '',
    baseUrl: normalizeAnthropicBaseUrl(
      getEnv('MINIMAX_API_BASE_URL') ?? getEnv('ANTHROPIC_BASE_URL'),
    ),
    model: getEnv('MINIMAX_MODEL') ?? getEnv('ANTHROPIC_MODEL') ?? 'MiniMax-M2.7',
    anthropicVersion: '2023-06-01',
  },
}

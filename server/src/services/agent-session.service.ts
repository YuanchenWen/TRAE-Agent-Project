import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config'
import { type AuthSession } from './auth.service'

export class AgentSessionService {
  private readonly sessionFile = config.agent.sessionFile

  async save(session: AuthSession): Promise<void> {
    await mkdir(path.dirname(this.sessionFile), { recursive: true })
    await writeFile(this.sessionFile, JSON.stringify(session, null, 2), 'utf8')
  }

  async load(): Promise<AuthSession | null> {
    try {
      const contents = await readFile(this.sessionFile, 'utf8')
      return JSON.parse(contents) as AuthSession
    } catch {
      return null
    }
  }

  async clear(): Promise<void> {
    await rm(this.sessionFile, { force: true })
  }

  async getStatus(): Promise<{
    active: boolean
    email?: string
    provider?: string
  }> {
    const session = await this.load()

    if (!session) {
      return { active: false }
    }

    return {
      active: true,
      email: session.user.email,
      provider: session.provider,
    }
  }
}

export const agentSessionService = new AgentSessionService()

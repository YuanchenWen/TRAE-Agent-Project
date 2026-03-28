import { Request, Response, NextFunction } from 'express'
import { authService, type AuthSession } from '../services/auth.service'

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { session, setCookie } = await authService.loadSession(req)

    if (!session) {
      res.status(401).json({ success: false, error: 'Gmail account not connected.' })
      return
    }

    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie)
    }

    res.locals.auth = session as AuthSession
    next()
  } catch (error) {
    next(error)
  }
}

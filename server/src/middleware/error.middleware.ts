import { Request, Response, NextFunction } from 'express'

const normalizeError = (err: unknown): Error =>
  err instanceof Error ? err : new Error('Internal Server Error')

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  void req
  void next

  const error = normalizeError(err)
  console.error(error.stack ?? error.message)
  res.status(500).json({ success: false, error: error.message })
}

import { Request, Response, NextFunction } from 'express'

export const validationMiddleware =
  (schema: unknown) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void schema
    void req
    void res
    next()
  }

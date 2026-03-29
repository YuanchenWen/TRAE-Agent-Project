import type {
  NextFunction,
  Request,
  Response,
} from 'express'

export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>

export const asyncHandler =
  (handler: AsyncRouteHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res, next).catch(next)
  }

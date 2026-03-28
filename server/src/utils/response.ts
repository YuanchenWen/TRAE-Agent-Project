import { Response } from 'express'

export const successResponse = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200,
): void => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  })
}

export const errorResponse = (
  res: Response,
  message: string = 'Error',
  statusCode: number = 500,
  error?: unknown,
): void => {
  res.status(statusCode).json({
    success: false,
    message,
    error: error ?? message,
  })
}

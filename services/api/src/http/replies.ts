import type { FastifyReply } from 'fastify'
import type { ApiErrorCode, ApiErrorResponse } from '@bravecat/contracts'
import { ErrorCode } from '@bravecat/contracts'
import type { ZodError } from 'zod'

export const sendError = (
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): FastifyReply => {
  const body: ApiErrorResponse = {
    error: details === undefined ? { code, message } : { code, message, details },
  }
  return reply.status(statusCode).send(body)
}

export const sendValidationError = (
  reply: FastifyReply,
  error: ZodError,
): FastifyReply =>
  sendError(
    reply,
    400,
    ErrorCode.ValidationFailed,
    '请求参数校验失败',
    error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  )

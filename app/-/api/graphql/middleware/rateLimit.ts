import { ResolverContextType } from "@/app/-/api/graphql/resolvers/getContext"
import { MiddlewareFn } from "type-graphql"

import AppError from "@/lib/common/AppError"
import {
  Duration,
  Ratelimit,
  RatelimitConfig,
} from "@/lib/models/rateLimitModel"

class RateLimitError extends AppError<{
  code: string
  status: number
  ip: string
  userId?: string
}> {}

function rateLimit(
  key: string,
  config?: RatelimitConfig,
): MiddlewareFn<ResolverContextType> {
  return async ({ context: ctx }, next) => {
    const ratelimit = new Ratelimit(config)

    const ip = ctx.clientId ?? ctx.clientIP
    const userId = ctx.me?.id

    const { success /* limit, remaining, reset, pending */ } =
      await ratelimit.limit(key, {
        userId,
        ip,
      })

    RateLimitError.assertWithStatus(success, 429, undefined, {
      key,
      ip,
      userId,
    })

    return next()
  }
}

export default rateLimit

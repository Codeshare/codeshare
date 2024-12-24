import { Ratelimit as UpstashRatelimit } from "@upstash/ratelimit"

import { redisClient as redis } from "@/lib/clients/redis/redis"
import { get } from "@/lib/common/env/env"

get("REDIS_KV_REST_API_URL").required().asUrlString()
get("REDIS_KV_REST_API_TOKEN").required().asString()

const RATELIMIT_LIMIT = get("RATELIMIT_LIMIT").default("30").asIntPositive()
const RATELIMIT_DURATION = get("RATELIMIT_DURATION")
  .default("60s")
  .asDurationString()

export type Unit = "ms" | "s" | "m" | "h" | "d"
export type Duration = `${number} ${Unit}` | `${number}${Unit}`
export type RatelimitConfig = {
  limit?: number
  duration?: Duration
}

type RatelimitResponse = {
  // Whether the request may pass(true) or exceeded the limit(false)
  success: boolean
  // Maximum number of requests allowed within a window.
  limit: number
  // How many requests the user has left within the current window
  remaining: number
  // Unix timestamp in milliseconds when the limits are reset.
  reset: number
  /**
   * For the MultiRegion setup we do some synchronizing in the background, after returning the current limit.
   * In most case you can simply ignore this.
   *
   * On Vercel Edge or Cloudflare workers, you need to explicitely handle the pending Promise like this:
   *
   * **Vercel Edge:**
   * https://nextjs.org/docs/api-reference/next/server#nextfetchevent
   *
   * ```ts
   * const { pending } = await ratelimit.limit("id")
   * event.waitUntil(pending)
   * ```
   */
  pending: Promise<unknown>
}

export class Ratelimit {
  private ratelimit: UpstashRatelimit

  constructor(
    {
      limit = RATELIMIT_LIMIT,
      duration = RATELIMIT_DURATION,
    }: RatelimitConfig = {
      limit: RATELIMIT_LIMIT,
      duration: RATELIMIT_DURATION,
    },
  ) {
    this.ratelimit = new UpstashRatelimit({
      redis,
      limiter: UpstashRatelimit.slidingWindow(limit, duration),
    })
  }

  private noLimit = async (): Promise<RatelimitResponse> => {
    return {
      success: true,
      limit: Infinity,
      remaining: Infinity,
      reset: 0,
      pending: Promise.resolve(),
    }
  }

  globalLimit = async (opts: {
    userId?: string | null | undefined
    ip: string
  }): Promise<RatelimitResponse> => {
    return this.limit("*", opts)
  }

  limit = async (
    key: string,
    { userId, ip }: { userId?: string | null | undefined; ip: string },
  ): Promise<RatelimitResponse> => {
    if (process.env.NODE_ENV == "development") return this.noLimit()

    return this.ratelimit.limit(
      `codeshare:api:ratelimit:${userId ?? ip}:${key}`,
    )
  }
}

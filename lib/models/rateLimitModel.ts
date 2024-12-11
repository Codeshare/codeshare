import { Ratelimit as UpstashRatelimit } from "@upstash/ratelimit"
import { get } from "env-var"
import { kv } from "@vercel/kv"

get("KV_REST_API_URL").required().asUrlString()
get("KV_REST_API_TOKEN").required().asString()

const RATELIMIT_WINDOW_UNIT = get("RATELIMIT_WINDOW_UNIT")
  .required()
  .asEnum(["s", "m", "h", "d"])
const RATELIMIT_WINDOW_SIZE = get("RATELIMIT_WINDOW_SIZE")
  .required()
  .asIntPositive()
const RATELIMIT_MAX_REQUESTS = get("RATELIMIT_MAX_REQUESTS")
  .required()
  .asIntPositive()

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

  constructor() {
    this.ratelimit = new UpstashRatelimit({
      redis: kv,
      limiter: UpstashRatelimit.slidingWindow(
        RATELIMIT_MAX_REQUESTS,
        `${RATELIMIT_WINDOW_SIZE} ${RATELIMIT_WINDOW_UNIT}`,
      ),
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

    return this.ratelimit.limit(`app:ratelimit:${key}:${userId ?? ip}`)
  }
}

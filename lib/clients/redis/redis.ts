import { Redis as UpstashRedis } from "@upstash/redis"
import { get } from "env-var"

const KV_REST_API_URL = get("KV_REST_API_URL").required().asString()
const KV_REST_API_TOKEN = get("KV_REST_API_TOKEN").required().asString()

export type Redis = UpstashRedis

export const rateLimitRedisClient = new UpstashRedis({
  url: KV_REST_API_URL,
  token: KV_REST_API_TOKEN,
})

export const redisClient = new UpstashRedis({
  url: KV_REST_API_URL,
  token: KV_REST_API_TOKEN,
})

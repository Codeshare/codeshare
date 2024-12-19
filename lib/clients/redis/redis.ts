import { Redis as UpstashRedis } from "@upstash/redis"
import { get } from "env-var"

const REDIS_KV_REST_API_URL = get("KV_REST_API_URL").required().asString()
const REDIS_KV_REST_API_TOKEN = get("KV_REST_API_TOKEN").required().asString()

export type Redis = UpstashRedis

export const rateLimitRedisClient = new UpstashRedis({
  url: REDIS_KV_REST_API_URL,
  token: REDIS_KV_REST_API_TOKEN,
})

export const redisClient = new UpstashRedis({
  url: REDIS_KV_REST_API_URL,
  token: REDIS_KV_REST_API_TOKEN,
})

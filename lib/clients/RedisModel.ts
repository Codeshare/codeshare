import { VercelKV as Redis } from "@vercel/kv"
import { get } from "env-var"
import redis from "@/lib/clients/redis"
import AppError, { ErrorShape } from "@/lib/common/AppError"
import { singularize } from "inflected"

const REDIS_MODELS_NAMESPACE = get("REDIS_MODELS_NAMESPACE")
  .required()
  .asString()

type RedisModelRecord = { expiresAt: Date }
export class RedisModelError extends AppError {}

type Index<ModelRecord> = keyof ModelRecord

export default class RedisModel<ModelRecord extends RedisModelRecord> {
  redis: Redis
  tableName: string
  rowName: string
  index: Index<ModelRecord>
  ttl?: number

  constructor(
    tableName: string,
    opts: { index: Index<ModelRecord>; ttl?: number },
  ) {
    this.redis = redis
    this.tableName = tableName
    this.rowName = singularize(this.tableName as string)
    this.index = opts.index
    this.ttl = opts?.ttl ? Math.floor(opts.ttl) : undefined
  }

  // utils
  key(id: string) {
    return `${REDIS_MODELS_NAMESPACE}:${this.tableName}:${id}`
  }

  parse(val: string): ModelRecord {
    try {
      return JSON.parse(val as string, reviveDates)
    } catch (err) {
      throw RedisModelError.wrapWithCode(
        err as ErrorShape,
        500,
        `error parsing ${this.rowName}`,
        {
          val,
        },
      )
    }
  }

  stringify(data: ModelRecord): string {
    return JSON.stringify(data)
  }

  // db operations

  async upsert(
    data: ModelRecord,
    opts?: { ttl: number },
  ): Promise<ModelRecord> {
    const id = data[this.index as keyof ModelRecord] as string
    const key = this.key(id)
    const str = this.stringify(data)
    const ttl = opts?.ttl ? Math.floor(opts.ttl) : this.ttl

    try {
      if (ttl != null) {
        await this.redis.setex(key, ttl, str)
      } else {
        await this.redis.set(key, str)
      }
    } catch (err) {
      throw RedisModelError.wrapWithCode(
        err,
        500,
        `error creating ${this.rowName}`,
        {
          key,
          data,
          ttl,
        },
      )
    }

    return data
  }

  async getOneById(id: string): Promise<ModelRecord | null> {
    const key = this.key(id)
    const data = await this.redis.get<ModelRecord | null>(key).catch((err) => {
      throw RedisModelError.wrapWithCode(
        err,
        500,
        `${this.rowName} fetch failed`,
        {
          key,
        },
      )
    })

    if (data == null) return null

    // FIXME: blah
    data.expiresAt = new Date(data.expiresAt)

    return data
  }

  async deleteOneById(id: string): Promise<boolean> {
    const key = this.key(id)
    const number = await this.redis.del(key).catch((err) => {
      throw RedisModelError.wrapWithCode(
        err,
        500,
        `${this.rowName} delete failed`,
        {
          key,
        },
      )
    })

    return Boolean(number)
  }
}

function reviveDates(k: string, v: string | number) {
  if (/created|expires/.test(k)) return new Date(v)
  return v
}

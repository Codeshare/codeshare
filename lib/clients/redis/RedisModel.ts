import { get } from "env-var"
import { singularize } from "inflected"

import { Redis, redisClient as redis } from "@/lib/clients/redis/redis"
import AppError, { AppErrorProps, ErrorShape } from "@/lib/common/AppError"
import ExactOmit from "@/lib/typeHelpers/ExactOmit"

const REDIS_NAMESPACE = get("REDIS_NAMESPACE").required().asString()

type RedisModelRecord = { expiresAt: Date }
type Index<ModelRecord> = keyof Omit<ModelRecord, "expiresAt">

export interface RedisModelErrorProps extends AppErrorProps {
  key?: string
  data?: unknown
  ttl?: number
}
export class RedisModelError extends AppError<RedisModelErrorProps> {}

export default class RedisModel<ModelRecord extends RedisModelRecord> {
  redis: Redis
  tableName: string
  rowName: string
  index: Index<ModelRecord>
  ttl: number

  constructor(
    tableName: string,
    opts: { index: Index<ModelRecord>; ttl: number },
  ) {
    this.redis = redis
    this.tableName = tableName
    this.rowName = singularize(this.tableName as string)
    this.index = opts.index
    this.ttl = opts?.ttl
  }

  // utils
  key(id: string) {
    return `${REDIS_NAMESPACE}:models:${this.tableName}:${id}`
  }

  parse(data: string): ModelRecord {
    try {
      return JSON.parse(data, reviveDates)
    } catch (err) {
      throw RedisModelError.wrapWithStatus<RedisModelErrorProps>(
        err as ErrorShape,
        500,
        `error parsing ${this.rowName}`,
        {
          data,
        },
      )
    }
  }

  stringify(data: ModelRecord): string {
    return JSON.stringify(data)
  }

  // db operations

  async upsert(
    data: ExactOmit<ModelRecord, "expiresAt">,
    opts?: { ttl?: number },
  ): Promise<ModelRecord> {
    const ttl = opts?.ttl ?? this.ttl

    AppError.assertWithStatus(
      ttl != null,
      500,
      `ttl is required for ${this.rowName}`,
    )

    const id = data[this.index as Index<ModelRecord>] as string
    const key = this.key(id)
    const record: ModelRecord = Object.assign(
      {
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + ttl),
      },
      data,
    )
    const str = this.stringify(record)

    try {
      await this.redis.setex(key, ttl, str)
    } catch (err) {
      throw RedisModelError.wrapWithStatus<RedisModelErrorProps>(
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

    return record
  }

  async getOneById(id: string): Promise<ModelRecord | null> {
    const key = this.key(id)
    const data = await this.redis.get<ModelRecord | null>(key).catch((err) => {
      throw RedisModelError.wrapWithStatus<RedisModelErrorProps>(
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
      throw RedisModelError.wrapWithStatus<RedisModelErrorProps>(
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

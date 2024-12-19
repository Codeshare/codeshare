import {
  CacheConfig,
  GraphQLResponse,
  QueryResponseCache,
  RequestParameters,
  Variables,
} from "relay-runtime"

import { IS_SERVER } from "@/lib/const/const"

class IsomorphicNetworkCache {
  private cache: QueryResponseCache | null

  constructor(queryResponseCache: QueryResponseCache | null) {
    this.cache = queryResponseCache
  }

  private getCacheKey(request: RequestParameters): string {
    return request.id ?? request.cacheID
  }

  get(
    request: RequestParameters,
    variables: Variables,
    cacheConfig: CacheConfig,
  ): GraphQLResponse | null {
    // check if cache is enabled
    if (this.cache == null) return null
    // check if request is a query
    if (request.operationKind !== "query") return null
    // check if force fetch
    if (cacheConfig?.force) return null

    const cacheKey = this.getCacheKey(request)

    return this.cache.get(cacheKey, variables)
  }

  set(
    request: RequestParameters,
    variables: Variables,
    payload: GraphQLResponse,
  ): void {
    // check if cache is enabled
    if (this.cache == null) return
    // check if request is a query
    if (request.operationKind !== "query") return

    const cacheKey = this.getCacheKey(request)

    return this.cache.set(cacheKey, variables, payload)
  }
}

const CACHE_TTL = 5 * 1000 // 5 seconds, to resolve preloaded results

const queryResponseCache: QueryResponseCache | null = IS_SERVER
  ? null
  : new QueryResponseCache({
      size: 100,
      ttl: CACHE_TTL,
    })

export default function createNetworkCache() {
  return new IsomorphicNetworkCache(queryResponseCache)
}

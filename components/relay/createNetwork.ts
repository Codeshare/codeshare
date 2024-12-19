import {
  CacheConfig,
  Network,
  RequestParameters,
  Variables,
} from "relay-runtime"

import CodeshareClient, { HeadersType } from "@/lib/clients/CodeshareClient"

import createNetworkCache from "./createNetworkCache"

export { type HeadersType } from "@/lib/clients/CodeshareClient"

export default function createNetwork(defaultInit?: { headers?: HeadersType }) {
  const networkCache = createNetworkCache()

  return Network.create(
    (
      request: RequestParameters,
      variables: Variables,
      cacheConfig: CacheConfig,
    ) => {
      const cached = networkCache.get(request, variables, cacheConfig)

      if (cached) return cached

      return new CodeshareClient(defaultInit)
        .graphql(request, variables)
        .then((payload) => {
          networkCache.set(request, variables, payload)
          return payload
        })
    },
  )
}

import { Environment, RecordSource, Store } from "relay-runtime"

import { IS_SERVER } from "@/lib/const/const"

import createNetwork, { HeadersType } from "./createNetwork"

export default function createEnvironment(opts?: {
  network?: { headers?: HeadersType }
}) {
  return new Environment({
    network: createNetwork(opts?.network),
    store: new Store(RecordSource.create()),
    isServer: IS_SERVER,
  })
}

export let globalEnvironment: Environment | null = null

export function getCurrentEnvironment(opts?: {
  network?: { headers?: HeadersType }
}) {
  if (IS_SERVER) {
    // every serverside pages have their own environment
    return createEnvironment(opts)
  }

  // clientside pages share the same global environment
  globalEnvironment = globalEnvironment ?? createEnvironment(opts)

  return globalEnvironment
}

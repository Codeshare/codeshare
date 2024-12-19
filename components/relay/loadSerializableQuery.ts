import {
  GraphQLResponse,
  OperationType,
  RequestParameters,
  VariablesOf,
} from "relay-runtime"
import { ConcreteRequest } from "relay-runtime/lib/util/RelayConcreteNode"

import createNetwork, { HeadersType } from "./createNetwork"

export interface SerializablePreloadedQuery<
  TRequest extends ConcreteRequest,
  TQuery extends OperationType,
> {
  params: TRequest["params"]
  variables: VariablesOf<TQuery>
  response: GraphQLResponse
}

// Call into raw network fetch to get serializable GraphQL query response
// This response will be sent to the client to "warm" the QueryResponseCache
// to avoid the client fetches.
export default async function loadSerializableQuery<
  TRequest extends ConcreteRequest,
  TQuery extends OperationType,
>(
  params: RequestParameters,
  variables: VariablesOf<TQuery>,
  headers: HeadersType,
): Promise<SerializablePreloadedQuery<TRequest, TQuery>> {
  const network = createNetwork({ headers })

  const response = (await network
    .execute(params, variables, {})
    .toPromise()) as GraphQLResponse

  return {
    params,
    variables,
    response,
  }
}

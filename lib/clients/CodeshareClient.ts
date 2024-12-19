import { GraphQLResponse, RequestParameters, Variables } from "relay-runtime"
import SimpleApiClient, { ExtendedRequestInit } from "simple-api-client"

import { get } from "@/lib/common/env/env"
import logger from "@/lib/common/logger"

const API_URL = get("VERCEL_URL").required().asString()

export interface HeadersType extends Record<string, string> {
  authorization: string
  "x-forwarded-for": string
}

export default class CodeshareClient extends SimpleApiClient {
  constructor(defaultInit?: { headers?: HeadersType }) {
    super(API_URL, (path, init) => {
      return {
        ...defaultInit,
        ...init,
        headers: {
          ...defaultInit?.headers,
          ...init?.headers,
        },
        // backoff: {
        //   statusCodes: /^(4\d[0-8]|5\d\d)$/,
        //   timeouts: [100, 200, 300],
        //   ...init?.backoff,
        // },
      }
    })
  }

  async graphql(
    request: RequestParameters,
    variables: Variables,
    init?: ExtendedRequestInit,
  ): Promise<GraphQLResponse> {
    const json = await this.json("/graphql", {
      ...init,
      method: "POST",
      json: { query: request.text, variables },
      backoff: {
        timeouts: [100, 200, 300],
        // TODO: full jitter?
        jitter: (duration: number) => duration * Math.random(),
      },
    }).catch((err) => {
      logger.error("GraphQL Request Error", { err })
      throw new Error(
        `Error fetching GraphQL query '${
          request.name
        }' with variables '${JSON.stringify(variables)}': ${JSON.stringify(
          json.errors,
        )}`,
      )
    })

    // GraphQL returns exceptions (for example, a missing required variable) in the "errors"
    // property of the response. If any exceptions occurred when processing the request,
    // throw an error to indicate to the developer what went wrong.
    if (Array.isArray(json.errors)) {
      logger.error("GraphQL Response Error", { errors: json.errors })
      throw new Error(
        `Error GraphQL response error for query '${
          request.name
        }' with variables '${JSON.stringify(variables)}': ${JSON.stringify(
          json.errors,
        )}`,
      )
    }

    return json
  }
}

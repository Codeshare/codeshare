import { IncomingHttpHeaders, IncomingMessage } from "http"

import Me from "@/app/-/api/graphql/nodes/Me"
import { ContextFunction } from "@apollo/server"
import logger from "@codeshare/log"
import App from "next/app"
import { AuthenticationError } from "type-graphql"

import AppError from "@/lib/common/AppError"
import sessionsModel from "@/lib/models/sessionsModel"
import usersModel, { UserRow, UsersModel } from "@/lib/models/usersModel"

export type ContextType = {
  xForwardedFor: string | undefined
  clientId: string
  clientIP: string
  me: UserRow | null
  token: string
}

export type ResolverContextType = {
  xForwardedFor: string | undefined
  clientId: string
  clientIP: string
  me: Me | null
  token: string
}

const DELIMETER = "_$$$_"

function getClientIp(xForwardedFor: string): string | null {
  if (xForwardedFor == null) return null

  const xForwardedForArray = xForwardedFor.split("")

  if (xForwardedForArray.length < 2) return null

  const clientIP = xForwardedForArray[xForwardedForArray.length - 2]

  if (clientIP.length === 0) return null

  return clientIP
}

const getContext: ContextFunction<
  [{ req: IncomingMessage }],
  ContextType
> = async ({ req }: { req: IncomingMessage }): Promise<ContextType> => {
  try {
    const headers: IncomingHttpHeaders = req.headers ?? {}
    const token = getTokenHeader(headers)
    const xForwardedFor = castHeaderToString(headers["x-forwarded-for"])

    // TODO: rate limit error
    AppError.assertWithStatus(
      xForwardedFor != null,
      400,
      "x-forwarded-for is required",
      { req },
    )

    const clientIP = getClientIp(xForwardedFor)

    // TODO: rate limit error
    AppError.assertWithStatus(clientIP != null, 400, "clientIP is required", {
      req,
    })

    let clientId

    if (!token.trim()) {
      logger.debug("getContext (no token)", { token })
      clientId = `${clientIP}`

      return { xForwardedFor, clientIP, clientId, me: null, token }
    }

    const session = await sessionsModel.getOneById(token)
    const me =
      session == null ? null : await usersModel.getOne("id", session.userId)

    // TODO: is token safe? how many tokens can a single user create?
    clientId = me == null ? clientIP : token

    logger.debug("getContext", { headers, clientId, me, token, session })

    return { xForwardedFor, clientIP, clientId, me, token }
  } catch (err) {
    const status = err.status ?? 500

    if (status >= 500) throw err

    // throw auth error
    const authErr = new AuthenticationError(err.message)
    Object.assign(authErr, { status: 401, silent: true })

    throw authErr
  }
}

export default getContext

export function getTokenHeader(headers?: { authorization?: string }): string {
  const auth = castHeaderToString(headers?.authorization)
  return auth ? auth.replace(/^token /, "") : ""
}

function castHeaderToString(header: string | string[] | undefined) {
  if (Array.isArray(header)) return header[0]
  return header
}

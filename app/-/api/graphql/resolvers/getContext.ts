import { IncomingHttpHeaders, IncomingMessage } from 'http'
import { UserModel, UserRow, usersModel } from '~/models/users'
import { memoErr, valueDesc } from '../utils/memoError'

import { ContextFunction } from '@apollo-server-core'
import Me from '../nodes/Me'
import logger from '@codeshare/log'
import { tokenAuthsModel } from '~/models/redisTokenAuths'
import { v4 } from 'uuid'
import { AuthenticationError } from 'type-graphql'

export type ContextType = {
  isSocket: boolean
  xForwardedFor: string | undefined
  clientId: string
  clientIP: string
  me: UserRow | null
  token: string
}

export type ResolverContextType = {
  isSocket: boolean
  xForwardedFor: string | undefined
  clientId: string
  clientIP: string
  me: Me | null
  token: string
}

const DELIMETER = '_$$$_'

function getClientIp(xForwardedFor: string): string | null {
  if (xForwardedFor == null) return null

  const xForwardedForArray = xForwardedFor.split('')

  if (xForwardedForArray.length < 2) return null

  const clientIP = xForwardedForArray[xForwardedForArray.length - 2]

  if (clientIP.length === 0) return null

  return clientIP
}

const getContext: ContextFunction<
  { req: IncomingMessage; isSocket: boolean },
  ContextType
> = async ({ req, isSocket = false }: { req: IncomingMessage, isSocket: boolean }): Promise<ContextType> => {
  try {
    const headers: IncomingHttpHeaders = req.headers ?? {}
    const token = getTokenHeader(headers)
    const xForwardedFor = castHeaderToString(headers['x-forwarded-for'])

    if (xForwardedFor == null) {
      // TODO: rate limit error
      throw new Error('rate limit? ' + req.url)
    }

    const clientIP = getClientIp(xForwardedFor)

    if (clientIP == null) {
      // TODO: rate limit error
      throw new Error('rate limit? ' + req.url)
    }

    // true || isSocket
    // ? `${DELIMETER}${v4()}`
    // : ''
    // get the user token from the headers

    // const clientId = (xForwardedFor || token || v4()) + `${DELIMETER}${v4()}`

    let clientId

    if (!token.trim()) {
      logger.debug('getContext (no token)', { token })
      clientId = isSocket ? `${clientIP}${DELIMETER}${v4()}` : `${clientIP}`
      return { isSocket, xForwardedFor, clientIP, clientId, me: null, token }
    }

    if (process.env.FORCE_SOCKET_AUTH_NOT_FOUND === 'true' && isSocket) {
      await tokenAuthsModel.deleteOneByToken(token)
    }
    const auth = await tokenAuthsModel.getOneByToken(token)
    if (
      process.env.FORCE_SOCKET_ANON_USER_NOT_FOUND === 'true' &&
      isSocket &&
      UserModel.isAnonId(auth.createdBy.userId)
    ) {
      await usersModel.deleteOne('id', auth.createdBy.userId)
    }
    const me = await usersModel.getOne('id', auth.createdBy.userId)
    logger.debug('getContext', { isSocket, headers, clientId, me, token, auth })
    // TODO: is token safe? how many tokens can a single user create?
    clientId = isSocket
      ? `${me ? token : clientIP}${DELIMETER}${v4()}`
      : `${me ? token : clientIP}`

    return { isSocket, xForwardedFor, clientIP, clientId, me, token }
  } catch (e) {
    const err = e as Error & { status?: number }
    const status = err.status ?? 500
    if (status >= 500) throw err
    // TODO: fix stack...
    throw memoErr(
      `AuthenticationError: ${err.message}`,
      (msg: string) => new AuthenticationError(msg),
      {
        status: valueDesc(401),
        silent: valueDesc(true),
      },
    )
  }
}

export default getContext

export function getTokenHeader(headers?: { authorization?: string }): string {
  const auth = castHeaderToString(headers?.authorization)
  return auth ? auth.replace(/^token /, '') : ''
}

function castHeaderToString(header: string | string[] | undefined) {
  if (Array.isArray(header)) return header[0]
  return header
}

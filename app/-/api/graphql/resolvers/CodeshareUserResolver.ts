import {
  Row as CodeshareUserRow,
  codeshareUsersModel,
} from '~/models/redisCodeshareUsers'
import { rateLimit } from '~/utils/rateLimit'
import abortable from 'abortable-generator'
import { redisClient } from '~/clients/redisClient'
import 'reflect-metadata'
import CodeshareUser, {
  CodeshareUserEdge,
  CodeshareUsersConnection,
} from './nodes/CodeshareUser'

import AppError from '~/helpers/AppError'
import {
  codesharesModel,
  Fields,
  Row as CodeshareRow,
} from '~/models/codeshares'
import { ResolverContextType } from './getContext'
import parseFields from 'graphql-parse-fields'
import logger from '@codeshare/log'

import {
  Resolver,
  Ctx,
  Arg,
  ObjectType,
  Field,
  Mutation,
  InputType,
  Info,
  Int,
  FieldResolver,
  Root,
  Subscription,
  ID,
  UseMiddleware,
} from 'type-graphql'

import Codeshare from './nodes/Codeshare'
import idUtils from '@codeshare/id-utils'
import { GraphQLResolveInfo } from 'graphql'
import { withFilter } from 'apollo-server'
import RedisPubSubEngine from 'graphql-ioredis-subscriptions'

type CodeshareJSON = Omit<CodeshareRow, 'createdAt' | 'modifiedAt'> & {
  createdAt: string
  modifiedAt: string
}
type CodeshareUserJSON = Omit<CodeshareUserRow, 'createdAt' | 'modifiedAt'> & {
  createdAt: string
  modifiedAt: string
}

// TODO: nullable props?
@InputType()
export class CursorInputType {
  @Field(() => Int, { nullable: true })
  position?: number
  @Field(() => Int, { nullable: true })
  selectionEnd?: number
}
@InputType()
class UpsertMeIntoCodeshareUsersInput {
  @Field()
  codeshareId!: string
  @Field()
  color!: string
  @Field(() => CursorInputType, { nullable: true })
  cursor!: CursorInputType | null
}
@ObjectType()
export class UpsertMeIntoCodeshareUsersResponse {
  @Field()
  codeshare!: Codeshare
  @Field()
  codeshareUserEdge!: CodeshareUserEdge
}
interface UpsertMeIntoCodeshareUsersResult {
  codeshare: CodeshareRow
  codeshareUserEdge: Omit<CodeshareUserEdge, 'node'> & {
    node: CodeshareUserRow
  }
}

@InputType()
class DeleteMeFromCodeshareUsersInputType {
  @Field()
  codeshareId!: string
}
@ObjectType()
export class DeleteMeFromCodeshareUsersResponse {
  @Field()
  codeshare!: Codeshare
  @Field()
  id!: string
}
interface DeleteMeFromCodeshareUsersResult {
  codeshare: CodeshareRow
  id: string
}

@InputType()
class CodeshareUserUpsertionsInput {
  @Field({ nullable: true })
  after?: string
  @Field()
  codeshareId!: string
}
@ObjectType()
class UpsertionsPayload {
  @Field()
  codeshare!: Codeshare
  @Field()
  upsertedCodeshareUserEdge!: CodeshareUserEdge
}
interface UpsertionsPayload {
  codeshare: Codeshare
  upsertedCodeshareUserEdge: CodeshareUserEdge
}
interface UpsertionsNotifyPayload {
  codeshare: CodeshareJSON
  codeshareUser: CodeshareUserJSON
}
interface UpsertionsResult {
  codeshare: CodeshareRow
  upsertedCodeshareUserEdge: Omit<CodeshareUserEdge, 'node'> & {
    node: CodeshareUserRow
  }
}

@InputType()
class CodeshareUserDeletionsInput {
  @Field()
  codeshareId!: string
  @Field(() => [String!])
  currentCodeshareUserIds!: Array<string>
}
@ObjectType()
class DeletionsPayload {
  @Field()
  codeshare!: Codeshare
  @Field()
  deletedCodeshareUserId!: string
}
interface DeletionsNotifyPayload {
  codeshare: CodeshareJSON
  codeshareUser: CodeshareUserJSON
}
interface DeletionsResult {
  codeshare: CodeshareRow
  deletedCodeshareUserId: string
}

export enum topics {
  UPSERTED_CODESHARE_USER = 'UPSERTED_CODESHARE_USER',
  DELETED_CODESHARE_USER = 'DELETED_CODESHARE_USER',
}

@Resolver(() => CodeshareUser)
export class CodeshareUserFieldResolver {
  @FieldResolver(() => ID)
  id(@Root() root: CodeshareUser) {
    return idUtils.encodeRelayId('CodeshareUser', root.id)
  }
}

@Resolver(() => Codeshare)
export default class CodeshareUserResolver {
  /**
   * Mutations
   */

  @Mutation(() => UpsertMeIntoCodeshareUsersResponse)
  @UseMiddleware(rateLimit('upsertMeIntoCodeshareUsers', 100))
  async upsertMeIntoCodeshareUsers(
    @Arg('input')
    input: UpsertMeIntoCodeshareUsersInput,
    @Ctx() ctx: ResolverContextType,
    @Info() info: GraphQLResolveInfo,
  ): Promise<UpsertMeIntoCodeshareUsersResult> {
    // TODO: only allow this via websockets
    if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
    const codeshareId = idUtils.decodeRelayId('Codeshare', input.codeshareId)
    const fields = parseFields<{ codeshare: Fields }>(info)
    const codeshareFields: Fields = [
      ...(Object.keys(fields?.codeshare || []) as Fields),
      'canEdit',
      'createdBy',
    ]
    const codeshare = await codesharesModel.getOne(
      'id',
      codeshareId,
      codeshareFields,
    )
    // check exists
    if (!codeshare) {
      throw new AppError("'codeshare' not found", { status: 404 })
    }
    // check permissions
    if (
      codeshare?.createdBy.userId !== ctx.me.id &&
      codeshare?.canEdit?.userIds != null &&
      codeshare?.canEdit?.userIds?.length !== 0 &&
      !codeshare?.canEdit?.userIds?.includes(ctx.me.id)
    ) {
      throw new AppError('access denied', {
        status: 403,
        clientId: ctx.clientId,
        userId: ctx.me.id,
      })
    }
    const meId = ctx.me.id
    const codeshareUser = await codeshareUsersModel.upsert({
      id: meId,
      activeClientIds: [ctx.clientId], // TODO: delete me
      codeshareId: idUtils.decodeRelayId('Codeshare', input.codeshareId),
      color: input.color,
      cursor: input.cursor,
      // created info
      createdAt: new Date(),
      createdBy: {
        userId: meId,
        clientId: ctx.clientId,
      },
      // modified info
      modifiedAt: new Date(),
      modifiedBy: {
        userId: meId,
        clientId: ctx.clientId,
      },
    })

    logger.debug('UPSERTED_CODESHARE_USER:publish:', {
      codeshareId,
    })
    await (redisClient.pubSub as RedisPubSubEngine<UpsertionsNotifyPayload>).publish(
      `${topics.UPSERTED_CODESHARE_USER}:${codeshareId}`,
      {
        codeshare: codeshareToJSON(codeshare),
        codeshareUser: userToJSON(codeshareUser),
      },
    )

    return {
      codeshare,
      codeshareUserEdge: {
        node: codeshareUser,
        cursor: idUtils.encodeRelayConnId(
          codeshareUser.modifiedAt.toISOString(),
        ),
      },
    }
  }

  @Mutation(() => DeleteMeFromCodeshareUsersResponse)
  @UseMiddleware(rateLimit('deleteMeFromCodeshareUsers', 100))
  async deleteMeFromCodeshareUsers(
    @Arg('input')
    input: DeleteMeFromCodeshareUsersInputType,
    @Ctx() ctx: ResolverContextType,
    @Info() info: GraphQLResolveInfo,
  ): Promise<DeleteMeFromCodeshareUsersResult> {
    return deleteMeFromCodeshareUsersHelper(input, ctx, info)
  }

  /**
   * Subscriptions
   */

  @Subscription(() => UpsertionsPayload, {
    subscribe: withFilter(
      (
        root: any,
        args: { input: CodeshareUserUpsertionsInput },
        ctx: ResolverContextType,
      ) => {
        AppError.assert(ctx.me, 'not authenticated', { status: 401 })
        const codeshareId = idUtils.decodeRelayId(
          'Codeshare',
          args.input.codeshareId,
        )
        logger.debug('UPSERTED_CODESHARE_USER:subscribe:', {
          codeshareId,
        })
        return redisClient.pubSub.asyncIterator<UpsertionsNotifyPayload>(
          `${topics.UPSERTED_CODESHARE_USER}:${codeshareId}`,
        )
      },
      (
        payload: UpsertionsNotifyPayload,
        args: { input: CodeshareUserUpsertionsInput },
        ctx: ResolverContextType,
      ) => {
        if (payload.codeshareUser.modifiedBy.clientId === ctx.clientId) {
          return false
        }
        logger.debug('UPSERTED_CODESHARE_USER:filter:', {
          codeshareId: idUtils.decodeRelayId(
            'Codeshare',
            args.input.codeshareId,
          ),
          payload,
        })
        return true
      },
    ),
  })
  async codeshareUserUpsertions(
    @Root() { codeshare, codeshareUser }: UpsertionsNotifyPayload,
    @Arg('input') input: CodeshareUserUpsertionsInput,
  ): Promise<UpsertionsResult> {
    return {
      codeshare: parseCodeshareJSON(codeshare),
      upsertedCodeshareUserEdge: {
        node: parseCodeshareUserJSON(codeshareUser),
        cursor: idUtils.encodeRelayConnId(codeshareUser.modifiedAt),
      },
    }
  }

  @Subscription(() => DeletionsPayload, {
    subscribe: withFilter(
      (
        rootValue: any,
        args: { input: CodeshareUserDeletionsInput },
        ctx: ResolverContextType,
      ) => {
        AppError.assert(ctx.me, 'not authenticated', { status: 401 })
        let pubSubPayloads: AsyncIterableIterator<DeletionsNotifyPayload> | null = null
        return abortable(async function* (raceAbort) {
          try {
            // get codeshare
            const codeshareId = idUtils.decodeRelayId(
              'Codeshare',
              args.input.codeshareId,
            )
            logger.debug('DELETED_CODESHARE_USER:subscribe:', {
              codeshareId,
            })
            const codeshare = await raceAbort(
              codesharesModel.getOne('id', codeshareId),
            )
            AppError.assert(codeshare, '"codeshare" not found', {
              id: codeshareId,
              status: 404,
            })

            // subscribe to pubsub
            pubSubPayloads = await raceAbort((signal) =>
              redisClient.pubSub.asyncIterator<DeletionsNotifyPayload>(
                `${topics.DELETED_CODESHARE_USER}:${codeshareId}`,
                signal,
              ),
            )

            // get current codeshareUserIds
            const currentCodeshareUserIds = args.input.currentCodeshareUserIds.map(
              (id) => idUtils.decodeRelayId('CodeshareUser', id),
            )
            const clientUserIds = new Set(currentCodeshareUserIds)
            const activeUsers = await raceAbort(() =>
              codeshareUsersModel.getAllByCodeshare(codeshare.id),
            )
            // determine starting point, initial codeshare user deletions
            const activeUserIds = new Set(activeUsers.map((user) => user.id))
            const { deleted: deletedUserIds } = diff(
              activeUserIds,
              clientUserIds,
            )
            // logger.debug('deleted codeshare users', {
            //   activeUserIds: [...activeUserIds],
            //   clientUserIds: [...clientUserIds],
            //   deletedUserIds: [...deletedUserIds],
            // })

            // yield deleted codeshareusers
            for (let deletedCodeshareUserId of deletedUserIds) {
              if (deletedCodeshareUserId === ctx.me?.id) continue // dont delete self
              yield {
                codeshare,
                deletedCodeshareUserId: idUtils.encodeRelayId(
                  'CodeshareUser',
                  deletedCodeshareUserId,
                ),
              }
            }

            // special ->
            // @ts-ignore
            // raceAbort(new Promise(() => {})).catch(() => pubSubPayloads?.return())
            // <- special

            // yield pubsub payloads
            for await (let payload of pubSubPayloads) {
              yield {
                codeshare,
                deletedCodeshareUserId: idUtils.encodeRelayId(
                  'CodeshareUser',
                  payload.codeshareUser.id,
                ),
              }
            }
          } finally {
            // @ts-ignore
            pubSubPayloads?.return()
          }
        })()
      },
      (
        payload: DeletionsResult, // TODO: fix me to payload later
        args: { input: CodeshareUserDeletionsInput },
        ctx: ResolverContextType,
      ) => {
        // TODO: fix me later..
        // if (payload.codeshareUser.modifiedBy.clientId === ctx.clientId) {
        //   return false
        // }
        logger.debug('DELETED_CODESHARE_USER:filter:', {
          codeshareId: idUtils.decodeRelayId(
            'Codeshare',
            args.input.codeshareId,
          ),
          payload,
        })
        return true
      },
    ),
  })
  async codeshareUserDeletions(
    @Root() result: DeletionsResult,
    @Arg('input') input: CodeshareUserDeletionsInput,
  ): Promise<DeletionsResult> {
    return result
  }

  /**
   * FieldResolvers
   */

  @FieldResolver(() => CodeshareUsersConnection)
  async users(
    @Root() codeshare: Codeshare,
    @Arg('after', { nullable: true }) after: string,
    @Arg('first', () => Int!) first: number,
    @Ctx() ctx: ResolverContextType,
  ) {
    const afterValue = after ? idUtils.decodeRelayConnId(after) : null

    const rows = await codeshareUsersModel.getAllByCodeshare(
      codeshare.id,
      afterValue ? new Date(afterValue) : null,
    )

    const edges: CodeshareUserEdge[] = []
    rows.forEach((codeshareUser) => {
      edges.push({
        // @ts-ignore
        node: codeshareUser as CodeshareUser,
        cursor: idUtils.encodeRelayConnId(
          codeshareUser.modifiedAt.toISOString(),
        ),
      })
    })

    let hasNextPage = edges.length > first
    if (hasNextPage) {
      edges.pop()
    }

    const startEdge = edges[0]
    const endEdge = edges[edges.length - 1]

    return {
      edges,
      pageInfo: {
        startCursor: startEdge
          ? idUtils.encodeRelayConnId(startEdge.node.modifiedAt.toISOString())
          : undefined,
        endCursor: endEdge
          ? idUtils.encodeRelayConnId(endEdge.node.modifiedAt.toISOString())
          : undefined,
        hasNextPage,
        hasPreviousPage: Boolean(after),
      },
      count: edges.length,
    }
  }
}

function diff<T>(
  next: Set<T>,
  prev: Set<T>,
): { added: Set<T>; deleted: Set<T> } {
  const deleted = new Set<T>(prev)
  next.forEach((item) => deleted.delete(item))
  const added = new Set<T>(next)
  prev.forEach((item) => added.delete(item))
  return {
    added,
    deleted,
  }
}

function codeshareToJSON(codeshare: CodeshareRow): CodeshareJSON {
  // HACK: to avoid serializing large codeshare objects
  return ({
    id: codeshare.id,
    createdAt: codeshare.createdAt.toISOString(),
    modifiedAt: codeshare.modifiedAt.toISOString(),
  } as any) as CodeshareJSON
}
function userToJSON(codeshare: CodeshareUserRow): CodeshareUserJSON {
  return {
    ...codeshare,
    createdAt: codeshare.createdAt.toISOString(),
    modifiedAt: codeshare.modifiedAt.toISOString(),
  }
}
function parseCodeshareJSON(codeshare: CodeshareJSON): CodeshareRow {
  return {
    ...codeshare,
    createdAt: new Date(codeshare.createdAt),
    modifiedAt: new Date(codeshare.modifiedAt),
  }
}
function parseCodeshareUserJSON(
  codeshareUser: CodeshareUserJSON,
): CodeshareUserRow {
  return {
    ...codeshareUser,
    createdAt: new Date(codeshareUser.createdAt),
    modifiedAt: new Date(codeshareUser.modifiedAt),
  }
}
let id = 0
function getId(pre: string) {
  id++
  return pre + id
}

export async function deleteMeFromCodeshareUsersHelper(
  input: any,
  ctx: any,
  info: any,
) {
  if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
  const codeshareId = idUtils.decodeRelayId('Codeshare', input.codeshareId)
  const fields = parseFields<{ codeshare: Fields }>(info)
  const codeshareFields: Fields = [
    ...(Object.keys(fields?.codeshare || []) as Fields),
    'canEdit',
    'createdBy',
  ]
  const codeshare = await codesharesModel.getOne(
    'id',
    codeshareId,
    codeshareFields,
  )
  if (!codeshare) {
    throw new AppError("'codeshare' not found", { status: 404, input })
  }

  const codeshareUser = await codeshareUsersModel.getOneByCodeshare(
    codeshare.id,
    ctx.me.id,
  )

  if (codeshareUser && codeshareUser?.modifiedBy.clientId === ctx.clientId) {
    // last modified by me
    await Promise.all([
      codeshareUsersModel.deleteOneByCodeshare(codeshare.id, ctx.me.id),
      (redisClient.pubSub as RedisPubSubEngine<DeletionsNotifyPayload>).publish(
        `${topics.DELETED_CODESHARE_USER}:${codeshareId}`,
        {
          codeshare: codeshareToJSON(codeshare),
          codeshareUser: userToJSON(codeshareUser),
        },
      ),
    ])
  }

  return {
    codeshare,
    id: ctx.me.id,
  }
}

export async function notifyDeleteCodeshareUser(
  codeshare: CodeshareRow,
  codeshareUser: CodeshareUserRow,
) {
  logger.debug('DELETED_CODESHARE_USER:notify:', {
    codeshare,
    codeshareUser,
  })
  return (redisClient.pubSub as RedisPubSubEngine<DeletionsNotifyPayload>).publish(
    `${topics.DELETED_CODESHARE_USER}:${codeshare.id}`,
    {
      codeshare: codeshareToJSON(codeshare),
      codeshareUser: userToJSON(codeshareUser),
    },
  )
}

// function withFilter2<T>(fn: T): T {
//   return fn
// }

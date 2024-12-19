import logger from "@codeshare/log"
import { subscriptionPlansModel } from "~/models/subscriptionPlans"
import { ignoreStatus } from "ignore-errors"

import "reflect-metadata"

import { redisClient } from "@/app/-/api/graphql/clients/redisClient"
import idUtils from "@codeshare/id-utils"
import AppError from "~/helpers/AppError"
import { codeshareUsersModel } from "~/models/redisCodeshareUsers"
import { memoErr, valueDesc } from "~/utils/memoError"
import { rateLimit } from "~/utils/rateLimit"
import { withFilter } from "apollo-server"
import { GraphQLResolveInfo } from "graphql"
import RedisPubSubEngine from "graphql-ioredis-subscriptions"
import parseFields from "graphql-parse-fields"
import r from "rethinkdb"
import {
  Arg,
  Args,
  Ctx,
  Field,
  FieldResolver,
  ID,
  Info,
  InputType,
  Mutation,
  ObjectType,
  Publisher,
  PubSub,
  Query,
  Resolver,
  ResolverFilterData,
  Root,
  Subscription,
  UseMiddleware,
} from "type-graphql"

import {
  Row as CodeshareRow,
  codesharesModel,
  Fields,
} from "./../models/codeshares"
import { notifyDeleteCodeshareUser } from "./CodeshareUserResolver"
import { ResolverContextType } from "./getContext"
import Codeshare, { CanEdit, CodeCheckpointInput } from "./nodes/Codeshare"
import Me, { CodeshareEdge } from "./nodes/Me"

// if you change this change ErrorPage.jsx in web and wherever else it's used
const ANON_CODESHARE_LIMIT = 10
const NON_PRO_CODESHARE_LIMIT = 20

type FieldsRow = { [key: string]: string }

@ObjectType()
export class CreateCodeshareResponse {
  @Field()
  me!: Me
  @Field()
  newCodeshareEdge!: CodeshareEdge
}

@InputType()
class CreateCodeshareInput {
  @Field({ nullable: true })
  id?: string
  @Field({ nullable: true })
  title?: string
  @Field({ nullable: true })
  clientMutationId?: string
}

@InputType()
class UpdateCodeshareInput {
  @Field()
  id!: string
  @Field({ nullable: true })
  save?: boolean
  @Field({ nullable: true })
  modeName?: string
  @Field({ nullable: true })
  tabSize?: string
  @Field({ nullable: true })
  title?: string
  @Field({ nullable: true })
  codeCheckpoint?: CodeCheckpointInput
  @Field({ nullable: true })
  clientMutationId?: string
}

@InputType()
class UpdateCodesharePermissionsInput {
  @Field()
  id!: string
  @Field()
  viewOnly!: boolean
}

@ObjectType()
export class UpdateCodeshareResponse {
  @Field()
  codeshare!: Codeshare
}

@ObjectType()
export class UpdateCodesharePermissionsResponseType {
  @Field()
  codeshare!: Codeshare
}

@InputType()
class DeleteCodeshareInput {
  @Field()
  id!: string
}
@ObjectType()
export class DeleteCodeshareResponseType {
  @Field()
  codeshareId!: string
  @Field()
  me!: Me
}

type CodeshareJSON = Omit<CodeshareRow, "createdAt" | "modifiedAt"> & {
  createdAt: string
  modifiedAt: string
}
interface CodeshareNotifyPayload {
  codeshare: CodeshareJSON
}

@InputType()
class CodeshareUpdatesInput {
  @Field()
  id!: string
}
@ObjectType()
class CodeshareUpdatesPayload {
  @Field()
  codeshare!: Codeshare
}

@InputType()
class CodeshareDeletionsInput {
  @Field()
  id?: string // TODO: not sure what this is for..
}
@ObjectType()
class CodeshareDeletionsPayload {
  @Field()
  deletedCodeshareId!: string
}

@InputType()
class CodeshareCreationsInput {
  @Field()
  id?: string // TODO: not sure what this is for..
}
@ObjectType()
class CodeshareCreationsPayload {
  @Field(() => CodeshareEdge)
  newCodeshareEdge!: CodeshareEdge
}

enum topics {
  CREATED_CODESHARE = "CREATED_CODESHARE",
  UPDATED_CODESHARE = "UPDATED_CODESHARE",
  DELETED_CODESHARE = "DELETED_CODESHARE",
}

@Resolver(() => Codeshare)
export default class CodeshareResolver {
  /**
   * FieldResolvers
   */

  @FieldResolver(() => ID)
  id(@Root() root: Codeshare) {
    return idUtils.encodeRelayId("Codeshare", root.id)
  }

  @FieldResolver(() => CanEdit)
  canEdit(@Root() root: Codeshare, @Ctx() ctx: ResolverContextType): CanEdit {
    const me = ctx.me
    AppError.assert(me, '"me" is required', { ctx })
    const canEdit = root.canEdit || {}
    return {
      me:
        canEdit.userIds == null ||
        root.createdBy.userId === me.id ||
        canEdit.userIds.some((userId) => userId === me.id),
      userIds: canEdit.userIds,
    }
  }

  /**
   * Queries
   */

  @Query(() => Codeshare)
  @UseMiddleware(rateLimit("codeshare", 60))
  async codeshare(
    @Arg("id") id: string,
    @Ctx() ctx: ResolverContextType,
    @Info() info: GraphQLResolveInfo,
  ) {
    if (!ctx.me) throw new AppError("not authenticated", { status: 401 })
    const codeshareId = idUtils.decodeRelayId("Codeshare", id)
    const fields = parseFields<FieldsRow>(info)
    let codeshare = await codesharesModel
      .updateOne(
        "id",
        codeshareId,
        {
          accessedAt: new Date(),
          modifiedAt: new Date(),
          modifiedBy: {
            userId: ctx.me.id,
            clientId: ctx.clientId,
          },
        },
        Object.keys(fields) as Fields,
      )
      .catch(ignoreStatus(404))
    if (!codeshare) {
      codeshare = await codesharesModel.insert(
        {
          id: codeshareId,
          accessedAt: new Date(),
          createdAt: new Date(),
          createdBy: {
            userId: ctx.me.id,
            clientId: ctx.clientId,
          },
          modifiedAt: new Date(),
          modifiedBy: {
            userId: ctx.me.id,
            clientId: ctx.clientId,
          },
        },
        Object.keys(fields) as Fields,
      )
    }
    return codeshare
  }

  /**
   * Mutations
   */

  @Mutation(() => CreateCodeshareResponse)
  @UseMiddleware(rateLimit("createCodeshare", 30))
  async createCodeshare(
    @Arg("input")
    { id, title }: CreateCodeshareInput,
    @Ctx() ctx: ResolverContextType,
    @Info() info: GraphQLResolveInfo,
  ) {
    logger.debug("createCodeshare", { id, title, ctx })
    if (!ctx.me) throw new AppError("not authenticated", { status: 401 })
    const fields = parseFields<{ newCodeshareEdge?: { node?: FieldsRow } }>(
      info,
    )
    const codeshareFields =
      fields?.newCodeshareEdge?.node &&
      (Object.keys(fields?.newCodeshareEdge?.node) as Fields | undefined)
    const idData =
      id == null ? {} : { id: idUtils.decodeRelayId("Codeshare", id) }
    const titleData = title == null ? {} : { title }
    const meDefaultCodeshareSettingsData = ctx.me.defaultCodeshareSettings ?? {}

    const count = await codesharesModel.countAll(
      "createdBy.userId",
      ctx.me.id,
      { signal: new AbortController().signal },
    )

    // check codeshare count limits
    logger.debug("createCodeshare: codeshare count:", {
      count,
      anonymous: ctx.me.anonymous,
      meId: ctx.me.id,
    })
    if (count > ANON_CODESHARE_LIMIT && ctx.me.anonymous) {
      throw memoErr(
        `cannot create more than ${ANON_CODESHARE_LIMIT} codeshares without registering`,
        (msg) => new AppError(msg, { cachedStack: `AppError: ${msg}` } as any),
        {
          status: valueDesc(409),
          limit: valueDesc(ANON_CODESHARE_LIMIT),
          code: valueDesc("ANON_CODESHARE_LIMIT_REACHED"),
        },
      )
    }

    if (count > NON_PRO_CODESHARE_LIMIT) {
      // if (ctx.me.anonymous) {
      //   // handled above
      // }
      // check if user is pro
      const plan = await subscriptionPlansModel.getOne(
        "createdBy.userId",
        ctx.me.id,
      )
      // check if pro plan exists
      if (plan == null) {
        throw memoErr(
          `cannot create more than ${NON_PRO_CODESHARE_LIMIT} codeshares without pro plan`,
          (msg) =>
            new AppError(msg, { cachedStack: `AppError: ${msg}` } as any),
          {
            status: valueDesc(409),
            limit: valueDesc(NON_PRO_CODESHARE_LIMIT),
            code: valueDesc("NON_PRO_CODESHARE_LIMIT_REACHED"),
          },
        )
      }
      // check if pro plan is expired
      if (plan.expiresAt <= new Date()) {
        throw memoErr(
          `cannot create more than ${NON_PRO_CODESHARE_LIMIT} codeshares without renewing pro plan`,
          (msg) =>
            new AppError(msg, { cachedStack: `AppError: ${msg}` } as any),
          {
            status: valueDesc(409),
            limit: valueDesc(NON_PRO_CODESHARE_LIMIT),
            code: valueDesc("NON_PRO_CODESHARE_LIMIT_REACHED"),
          },
        )
      }
    }

    const codeshare = await codesharesModel.insert(
      {
        ...idData,
        ...titleData,
        ...meDefaultCodeshareSettingsData,
        accessedAt: new Date(),
        createdAt: new Date(),
        createdBy: {
          userId: ctx.me.id,
          clientId: ctx.clientId,
        },
        modifiedAt: new Date(),
        modifiedBy: {
          userId: ctx.me.id,
          clientId: ctx.clientId,
        },
      },
      codeshareFields,
    )
    await (
      redisClient.pubSub as RedisPubSubEngine<CodeshareNotifyPayload>
    ).publish(`${topics.CREATED_CODESHARE}:${ctx.me.id}`, {
      codeshare: toJSON(codeshare),
    })

    return {
      me: ctx.me,
      newCodeshareEdge: {
        node: codeshare,
        cursor: idUtils.encodeRelayConnId(codeshare.createdAt.toISOString()),
      },
    }
  }

  @Mutation(() => UpdateCodeshareResponse)
  @UseMiddleware(rateLimit("updateCodeshare", 125))
  async updateCodeshare(
    @Arg("input")
    {
      id,
      modeName,
      tabSize,
      title,
      codeCheckpoint,
      save,
    }: UpdateCodeshareInput,
    @Ctx() ctx: ResolverContextType,
    @Info() info: GraphQLResolveInfo,
  ) {
    if (!ctx.me) throw new AppError("not authenticated", { status: 401 })
    const codeshareId = idUtils.decodeRelayId("Codeshare", id)
    let codeshare = await codesharesModel.getOne("id", codeshareId)
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
      throw new AppError("access denied", {
        status: 403,
        clientId: ctx.clientId,
        userId: ctx.me.id,
      })
    }
    const updateCreatedBy = save
      ? {
          createdBy: {
            clientId: ctx.clientId,
            userId: ctx.me.id,
          },
        }
      : {}
    const updateCodeCheckpoint = codeCheckpoint
      ? {
          codeCheckpoint: {
            ...codeCheckpoint,
            codeHistoryId: idUtils.decodeRelayId(
              "CodeHistory",
              codeCheckpoint.codeHistoryId,
            ),
            createdBy: {
              clientId: ctx.clientId,
              userId: ctx.me.id,
            },
          },
        }
      : {}
    const updateModeName = modeName ? { modeName } : {}
    const updateTabSize = tabSize ? { tabSize } : {}
    const updateTitle = title != null ? { title } : {}
    codeshare = await codesharesModel.updateOne("id", codeshareId, {
      ...updateCreatedBy,
      ...updateCodeCheckpoint,
      ...updateModeName,
      ...updateTabSize,
      ...updateTitle,
      modifiedAt: new Date(),
      modifiedBy: {
        clientId: ctx.clientId,
        userId: ctx.me.id,
      },
    })
    await (
      redisClient.pubSub as RedisPubSubEngine<CodeshareNotifyPayload>
    ).publish(`${topics.UPDATED_CODESHARE}:${codeshareId}`, {
      codeshare: toJSON(codeshare),
    })
    const fields = parseFields<{ codeshare: FieldsRow }>(info)
    const codeshareFields =
      fields?.codeshare &&
      (Object.keys(fields?.codeshare) as Fields | undefined)
    codeshare = pick(codeshare, codeshareFields)
    // @ts-ignore
    return { codeshare }
  }

  @Mutation(() => UpdateCodesharePermissionsResponseType)
  @UseMiddleware(rateLimit("updateCodesharePermissions", 100))
  async updateCodesharePermissions(
    @Arg("input")
    { id, viewOnly }: UpdateCodesharePermissionsInput,
    @Ctx() ctx: ResolverContextType,
  ) {
    if (!ctx.me) throw new AppError("not authenticated", { status: 401 })
    const codeshareId = idUtils.decodeRelayId("Codeshare", id)
    let codeshare = await codesharesModel.getOne("id", codeshareId, [
      "id",
      "canEdit",
      "createdBy",
    ])
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
      throw new AppError("access denied", {
        status: 403,
        clientId: ctx.clientId,
        userId: ctx.me.id,
      })
    }
    // if turning permissions on, make sure user has codeshare pro
    if (viewOnly) {
      const plan = await subscriptionPlansModel.getOne(
        "createdBy.userId",
        ctx.me.id,
      )
      if (plan == null) {
        throw new AppError("cannot set view only without codeshare pro", {
          status: 403,
          code: "NON_PRO_SUBSCRIBER",
        })
      }
      if (plan.expiresAt < new Date()) {
        throw new AppError("cannot set view only without codeshare pro", {
          status: 403,
          code: "PLAN_EXPIRED",
        })
      }
      codeshare = await codesharesModel.updateOne("id", codeshareId, {
        canEdit: {
          userIds: [ctx.me.id],
        },
        modifiedAt: new Date(),
        modifiedBy: {
          userId: ctx.me.id,
          clientId: ctx.clientId,
        },
      })
      if (codeshare) {
        await codeshareUsersModel.deleteAllByCodeshareExcept(
          codeshareId,
          [ctx.me.id].concat(codeshare.canEdit?.userIds || []),
          (deletedUser) =>
            notifyDeleteCodeshareUser(codeshare as CodeshareRow, deletedUser),
        )
      }
    } else {
      codeshare = await codesharesModel.updateOne("id", codeshareId, {
        canEdit: {
          // @ts-ignore
          userIds: r.literal(),
        },
        modifiedAt: new Date(),
        modifiedBy: {
          userId: ctx.me.id,
          clientId: ctx.clientId,
        },
      })
    }
    await (
      redisClient.pubSub as RedisPubSubEngine<CodeshareNotifyPayload>
    ).publish(`${topics.UPDATED_CODESHARE}:${codeshareId}`, {
      codeshare: toJSON(codeshare),
    })
    return {
      codeshare,
    }
  }

  @Mutation(() => DeleteCodeshareResponseType)
  @UseMiddleware(rateLimit("deleteCodeshare", 60))
  async deleteCodeshare(
    @Arg("input")
    input: DeleteCodeshareInput,
    @Ctx() ctx: ResolverContextType,
  ) {
    if (!ctx.me) throw new AppError("not authenticated", { status: 401 })
    const codeshareId = idUtils.decodeRelayId("Codeshare", input.id)
    const codeshare = await codesharesModel.getOne("id", codeshareId, [
      "id",
      "canEdit",
      "createdBy",
    ])
    // check exists
    if (!codeshare) {
      throw new AppError("'codeshare' not found", { status: 404 })
    }
    // check permissions
    if (
      codeshare.createdBy.userId !== ctx.me.id // &&
      // codeshare?.canEdit?.userIds != null &&
      // codeshare?.canEdit?.userIds?.length !== 0 &&
      // !codeshare?.canEdit?.userIds?.includes(ctx.me.id)
    ) {
      throw new AppError("access denied", {
        status: 403,
        clientId: ctx.clientId,
        userId: ctx.me.id,
      })
    }
    await codesharesModel.deleteOne("id", codeshareId)
    await (
      redisClient.pubSub as RedisPubSubEngine<CodeshareDeletionsPayload>
    ).publish(`${topics.DELETED_CODESHARE}:${ctx.me.id}`, {
      deletedCodeshareId: codeshareId,
    })
    return {
      codeshareId: idUtils.encodeRelayId("Codeshare", codeshareId),
      me: ctx.me,
    }
  }

  /**
   * Subscriptions
   */

  @Subscription(() => CodeshareCreationsPayload, {
    subscribe: withFilter(
      (
        rootValue: any,
        args: { input: CodeshareCreationsInput },
        ctx: ResolverContextType,
      ) => {
        AppError.assert(ctx.me, "not authenticated", { status: 401 })
        return redisClient.pubSub.asyncIterator<CodeshareCreationsPayload>(
          `${topics.CREATED_CODESHARE}:${ctx.me.id}`,
        )
      },
      (
        payload: CodeshareNotifyPayload,
        args: { input: CodeshareCreationsInput },
        ctx: ResolverContextType,
      ) => {
        if (payload.codeshare.modifiedBy.clientId === ctx.clientId) {
          return false
        }
        logger.debug("CREATED_CODESHARE:filter:", {
          payload,
        })
        return true
      },
    ),
  })
  async codeshareCreations(
    @Root() { codeshare }: CodeshareNotifyPayload,
    @Arg("input") input: CodeshareCreationsInput,
  ): Promise<CodeshareCreationsPayload> {
    // TODO: fields?
    return {
      newCodeshareEdge: {
        node: castDates(codeshare),
        cursor: idUtils.encodeRelayConnId(codeshare.createdAt),
      },
    }
  }

  @Subscription(() => CodeshareUpdatesPayload, {
    subscribe: withFilter(
      (
        rootValue: any,
        args: { input: CodeshareUpdatesInput },
        ctx: ResolverContextType,
      ) => {
        AppError.assert(ctx.me, "not authenticated", { status: 401 })
        const codeshareId = idUtils.decodeRelayId("Codeshare", args.input.id)
        return redisClient.pubSub.asyncIterator(
          `${topics.UPDATED_CODESHARE}:${codeshareId}`,
        )
      },
      (
        payload: CodeshareNotifyPayload,
        args: { input: CodeshareUpdatesInput },
        ctx: ResolverContextType,
      ) => {
        if (payload.codeshare.modifiedBy.clientId === ctx.clientId) {
          return false
        }
        logger.debug("UPDATED_CODESHARE:filter:", {
          payload,
        })
        return true
      },
    ),
  })
  async codeshareUpdates(
    @Root() { codeshare }: CodeshareNotifyPayload,
    @Arg("input") input: CodeshareUpdatesInput,
  ): Promise<CodeshareUpdatesPayload> {
    // TODO: fields?
    return {
      codeshare: castDates(codeshare),
    }
  }

  @Subscription(() => CodeshareDeletionsPayload, {
    subscribe: withFilter(
      (
        rootValue: any,
        args: { input: CodeshareDeletionsPayload },
        ctx: ResolverContextType,
      ) => {
        AppError.assert(ctx.me, "not authenticated", { status: 401 })
        return redisClient.pubSub.asyncIterator(
          `${topics.DELETED_CODESHARE}:${ctx.me.id}`,
        )
      },
      (
        payload: CodeshareDeletionsPayload,
        args: { input: CodeshareDeletionsInput },
        ctx: ResolverContextType,
      ) => {
        // TODO: fix this later
        // if (payload.codeshare.modifiedBy.clientId === ctx.clientId) {
        //   return false
        // }
        logger.debug("DELETED_CODESHARE:filter:", {
          payload,
        })
        return true
      },
    ),
  })
  async codeshareDeletions(
    @Root() payload: CodeshareNotifyPayload,
    @Arg("input") input: CodeshareDeletionsInput,
  ): Promise<CodeshareDeletionsPayload> {
    return {
      deletedCodeshareId: idUtils.encodeRelayId(
        "Codeshare",
        payload.codeshare.id,
      ),
    }
  }
}

function toJSON(codeshare: CodeshareRow): CodeshareNotifyPayload["codeshare"] {
  return {
    ...codeshare,
    createdAt: codeshare.createdAt.toISOString(),
    modifiedAt: codeshare.modifiedAt.toISOString(),
  }
}

function castDates(codeshare: CodeshareNotifyPayload["codeshare"]): Codeshare {
  return {
    ...codeshare,
    createdAt: new Date(codeshare.createdAt),
    modifiedAt: new Date(codeshare.modifiedAt),
  } as unknown as Codeshare
}

function pick<T>(obj: T, fields?: Array<string>): T {
  if (!fields) return obj
  return fields.reduce((memo, field) => {
    // @ts-ignore
    memo[field] = obj[field]
    return memo
  }, {} as T)
}

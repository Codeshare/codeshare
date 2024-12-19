import logger from "@codeshare/log"

import "reflect-metadata"

import rateLimit from "@/app/-/api/graphql/middleware/rateLimit"
import { codesharesModel } from "@/app/-/api/graphql/models/codeshares"
import { anonUsersModel } from "@/app/-/api/graphql/models/redisAnonUsers"
import { tokenAuthsModel } from "@/app/-/api/graphql/models/redisTokenAuths"
import { RegisteredUserRow, UserRow } from "@/app/-/api/graphql/models/users"
import idUtils from "@codeshare/id-utils"
import { redisClient } from "~/clients/redisClient"
import { Row as EmailRow, emailsModel } from "~/models/emails"
import { createToken } from "~/models/redisTokenAuths"
import { subscriptionPlansModel } from "~/models/subscriptionPlans"
import comparePassword from "~/utils/comparePassword"
import hashPassword from "~/utils/hashPassword"
import { withFilter } from "apollo-server"
import { GraphQLResolveInfo } from "graphql"
import RedisPubSubEngine from "graphql-ioredis-subscriptions"
import { ignoreStatus } from "ignore-errors"
import r from "rethinkdb"
import { obj } from "through2"
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  ID,
  Info,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Publisher,
  PubSub,
  PubSubEngine,
  Query,
  Resolver,
  ResolverFilterData,
  Root,
  Subscription,
  UseMiddleware,
} from "type-graphql"

import pubSub from "@/lib/clients/pubSub"
import AppError from "@/lib/common/AppError"
import usersModel, { UsersModel } from "@/lib/models/usersModel"

import UserSettings from "./fields/UserSettings"
import { type ResolverContextType } from "./getContext"
import Codeshare from "./nodes/Codeshare"
import Me, { CodeshareConnection } from "./nodes/Me"
import Viewer from "./nodes/Viewer"

/**
 * Subscription Topics & Payloads
 */
enum topics {
  UPDATED_ME = "UPDATED_ME",
}
interface MeUpdatesPayload {
  me: UserJSON
}
interface MeUpdatesResult {
  viewer: {
    me: UserRow
  }
}

type UserJSON = Omit<UserRow, "createdAt" | "modifiedAt"> & {
  createdAt: string
  modifiedAt: string
}

/**
 * Inputs
 */
@InputType()
class SettingsType {
  @Field({ nullable: true })
  keymap?: string
  @Field({ nullable: true })
  theme?: string
}
@InputType()
class DefaultCodeshareSettingsType {
  // TODO: Ishan
  @Field({ nullable: true })
  modeName?: string
  @Field({ nullable: true })
  tabSize?: string
}
@InputType()
class UpdateMeInput {
  @Field({ nullable: true })
  name?: string
  @Field({ nullable: true })
  email?: string
  @Field({ nullable: true })
  password?: string
  @Field({ nullable: true })
  settings?: SettingsType
  @Field({ nullable: true })
  defaultCodeshareSettings?: DefaultCodeshareSettingsType
  @Field({ nullable: true })
  companyImage?: string
  @Field({ nullable: true })
  clientMutationId?: string
}
@InputType()
class MeUpdatesInput {
  @Field({ nullable: true })
  clientMutationId?: string
}
@InputType()
class LoginInput {
  @Field()
  email!: string
  @Field()
  password!: string
  @Field({ nullable: true })
  clientMutationId?: string
}
@InputType()
class RegisterInput extends LoginInput {
  @Field()
  name!: string
  @Field({ nullable: true })
  settings?: SettingsType
}
@InputType()
class RegisterAnonymousInput {
  @Field({ nullable: true })
  clientMutationId?: string
}
@InputType()
class DeleteMeInput {
  @Field({ nullable: true })
  clientMutationId?: string
}
@InputType()
class LogoutInput {
  @Field({ nullable: true })
  clientMutationId?: string
}

/**
 * Responses
 */
@ObjectType()
class ViewerResponse {
  @Field()
  viewer!: Viewer
}
@ObjectType()
export class AuthResponse {
  @Field()
  viewer!: Viewer
  @Field()
  token!: string
}

function hasSomeKeys(val: unknown): boolean {
  if (typeof val !== "object" || val === null) return false
  const obj: Record<string, unknown> = val as Record<string, unknown>

  for (const key in obj) {
    if (obj[key]) return true
  }

  return false
}

/**
 * Resolver
 */
@Resolver(() => Me)
export default class MeResolver {
  /**
   * Queries
   */
  @Query(() => Me)
  @UseMiddleware(rateLimit("me", { limit: 60, duration: "1m" }))
  async me(@Ctx() ctx: ResolverContextType) {
    AppError.assertWithStatus(ctx.me != null, 401, "not authenticated")

    const me = await usersModel.getOne("id", ctx.me.id)

    AppError.assertWithStatus(me != null, 404, "'me' not found", {
      id: ctx.me.id,
    })

    return me
  }

  /**
   * Mutations
   */

  @Mutation(() => ViewerResponse)
  @UseMiddleware(rateLimit("updateMe", { limit: 60, duration: "1m" }))
  async updateMe(
    @Arg("input")
    {
      name,
      email,
      password,
      settings,
      defaultCodeshareSettings,
      companyImage,
    }: UpdateMeInput,
    @Ctx() ctx: ResolverContextType,
    // @PubSub(topics.UPDATED_ME)
    // notify: Publisher<MeUpdatesPayload>,
  ): Promise<ViewerResponse> {
    AppError.assertWithStatus(ctx.me != null, 401)

    // ensure email is lowercase
    const lowerEmail = email?.toLowerCase()

    const allUserUpdateData = Object.fromEntries(
      Object.entries({
        settings,
      }).filter(([_, value]) => value != null),
    )
    const registeredUserUpdateData = Object.fromEntries(
      Object.entries({
        name,
        email: lowerEmail,
        password,
      }).filter(([_, value]) => value != null),
    )
    const proUserUpdateData = Object.fromEntries(
      Object.entries({
        defaultCodeshareSettings,
        companyImage,
      }).filter(([_, value]) => value != null),
    )
    const hasAllUserUpdates = hasSomeKeys(allUserUpdateData)
    const hasRegisteredUserUpdates = hasSomeKeys(registeredUserUpdateData)
    const hasProUserUpdates = hasSomeKeys(proUserUpdateData)

    /**
     * Basic Data Validation
     * ensure that at least one field is being updated
     */

    AppError.assertWithStatus(
      hasAllUserUpdates || hasRegisteredUserUpdates || hasProUserUpdates,
      400,
      "missing update data",
    )

    /**
     * Access Control
     * ensure that the user is not trying to update a field that they are not allowed to
     */

    if (hasRegisteredUserUpdates) {
      AppError.assertWithStatus(
        !ctx.me.anonymous,
        403,
        "anonymous users cannot update name, email, or password",
      )
    }
    if (hasProUserUpdates) {
      // check if user is pro
      const plan = await subscriptionPlansModel.getOne(
        "createdBy.userId",
        ctx.me.id,
      )
      // check if pro plan exists
      AppError.assertWithStatus(
        plan != null,
        403,
        "cannot set default codeshare settings without pro plan",
      )
      // check if pro plan is not expired
      AppError.assertWithStatus(
        plan.expiresAt > new Date(),
        403,
        "cannot set default codeshare settings without renewing pro plan",
        {
          errorCode: "EXPIRED_SUBSCRIBER",
        },
      )
    }

    /**
     * Update Data Validation
     * validate email address
     */

    const me = await usersModel.updateOne("id", ctx.me.id, {
      ...allUserUpdateData,
      ...registeredUserUpdateData,
      ...proUserUpdateData,
      modifiedAt: new Date(),
      modifiedBy: {
        clientId: ctx.clientId,
        userId: ctx.me.id,
      },
    })
    // TODO: 409 email already exists error message..

    ctx.me = me as Me

    await pubSub.publish<MeUpdatesPayload>(`${topics.UPDATED_ME}:${me.id}`, {
      me: toJSON(me),
    })

    return { viewer: { me: me as Me } }
  }

  /**
   * Subscriptions
   */

  @Subscription(() => ViewerResponse, {
    // topics: topics.UPDATED_ME,
    // filter: ({
    //   payload,
    //   args,
    //   context: ctx,
    // }: ResolverFilterData<
    //   MeUpdatesPayload,
    //   MeUpdatesInput,
    //   ResolverContextType
    // >) => {
    //   if (payload.me.modifiedBy.clientId === ctx.clientId) return false
    //   return payload.me.id === ctx.me?.id
    // },
    subscribe: withFilter(
      (
        rootValue: any,
        args: { input: MeUpdatesInput },
        ctx: ResolverContextType,
      ) => {
        AppError.assert(ctx.me, "not authenticated", { status: 401 })
        return redisClient.pubSub.asyncIterator<MeUpdatesPayload>(
          `${topics.UPDATED_ME}:${ctx.me.id}`,
        )
      },
      (
        payload: MeUpdatesPayload,
        args: { input: MeUpdatesInput },
        ctx: ResolverContextType,
      ) => {
        if (payload.me.modifiedBy.clientId === ctx.clientId) {
          return false
        }
        logger.debug("UPDATED_ME:filter:", {
          payload,
        })
        return true
      },
    ),
  })
  async meUpdates(
    @Root() payload: MeUpdatesPayload,
    @Arg("input") input: MeUpdatesInput,
  ): Promise<MeUpdatesResult> {
    return { viewer: { me: castDates(payload.me) } }
  }

  /**
   * Authentication Mutations
   */

  // @Mutation(() => AuthResponse)
  // @UseMiddleware(rateLimit('deleteMe', 30))
  // async deleteMe(
  //   @Arg('input') input: DeleteMeInput,
  //   @Ctx() ctx: ResolverContextType,
  // ): Promise<AuthResponse> {
  //   if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
  //   if (ctx.me.anonymous) {
  //     // anon user to delete
  //     return {
  //       viewer: { me: ctx.me },
  //       token: ctx.token,
  //     }
  //   }
  //   await Promise.all([
  //     usersModel.deleteOne('id', ctx.me.id),
  //     codesharesModel.deleteAll('createdBy.userId', ctx.me.id),
  //     emailsModel.deleteAll('createdBy.userId', ctx.me.id),
  //     tokenAuthsModel.deleteOneByToken(ctx.token),
  //   ])
  //   // TODO: disconnect socket?
  //   ctx.me = null
  //   return this.registerAnonymous(ctx, {})
  // }

  // @Mutation(() => AuthResponse)
  // @UseMiddleware(rateLimit('logout', 30))
  // async logout(
  //   @Arg('input') input: LogoutInput,
  //   @Ctx() ctx: ResolverContextType,
  // ): Promise<AuthResponse> {
  //   if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
  //   if (ctx.me.anonymous) {
  //     // anon user no need to logout
  //     return {
  //       viewer: { me: ctx.me },
  //       token: ctx.token,
  //     }
  //   }
  //   // TODO: disconnect socket?
  //   ctx.me = null
  //   const [auth] = await Promise.all([
  //     this.registerAnonymous(ctx, {}),
  //     // delete old auth only, user is not anon.. they are authed and logging out
  //     tokenAuthsModel.deleteOneByToken(ctx.token),
  //   ])

  //   return auth
  // }

  // @Mutation(() => AuthResponse)
  // @UseMiddleware(rateLimit('register', 30))
  // async register(
  //   @Arg('input')
  //   { email, password, name, settings, clientMutationId }: RegisterInput,
  //   @Ctx() ctx: ResolverContextType,
  //   // @PubSub(topics.UPDATED_ME)
  //   // notify: Publisher<MeUpdatesPayload>,
  // ): Promise<AuthResponse> {
  //   if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
  //   if (!ctx.me.anonymous) {
  //     throw new AppError('already registered', {
  //       status: 409,
  //       email,
  //       clientId: ctx.clientId,
  //       userId: ctx.me.id,
  //     })
  //   }
  //   const registeredUserId = UserModel.removeAnonNamespace(ctx.me.id)
  //   // register email address
  //   try {
  //     await emailsModel.insert({
  //       id: email.toLowerCase(),
  //       createdAt: new Date(),
  //       createdBy: {
  //         clientId: ctx.clientId,
  //         userId: registeredUserId,
  //       },
  //     })
  //   } catch (e) {
  //     const err = e as AppError
  //     if (err.status === 409) {
  //       try {
  //         return await this.login({ email, password }, ctx)
  //       } catch (e) {
  //         const err = e as AppError
  //         throw AppError.wrap(err, 'user with email already exists', {
  //           status: 409,
  //           email,
  //           clientId: ctx.clientId,
  //           userId: ctx.me.id,
  //         })
  //       }
  //     }
  //   }
  //   // update anon user to registered user
  //   const settingsUpdates = settings == null ? {} : { settings }
  //   const hashedPassword = await hashPassword(password)
  //   let me
  //   if (UserModel.isAnonId(ctx.me.id)) {
  //     me = await usersModel.insert({
  //       id: registeredUserId,
  //       anonymous: false,
  //       name,
  //       password: hashedPassword,
  //       loginCount: 1,
  //       ...settingsUpdates,
  //       createdAt: ctx.me.createdAt,
  //       modifiedAt: new Date(),
  //       modifiedBy: {
  //         clientId: ctx.clientId,
  //         userId: ctx.me.id,
  //       },
  //     })
  //     // migrate anon created codeshares
  //     codesharesModel.migrate(ctx.me.id, {
  //       createdBy: {
  //         clientId: ctx.clientId,
  //         userId: me.id, // registered id
  //       },
  //       modifiedAt: new Date(),
  //       modifiedBy: {
  //         clientId: ctx.clientId,
  //         userId: ctx.me.id,
  //       },
  //     })
  //   } else {
  //     logger.error('unexpected rethinkdb user registration', {
  //       err: new AppError<{ userId: string }>(
  //         'unexpected rethinkdb user registration',
  //         {
  //           status: 500,
  //           userId: ctx.me.id,
  //         },
  //       ),
  //     })
  //     me = await usersModel.updateOne('id', ctx.me.id, {
  //       anonymous: false,
  //       name,
  //       password: hashedPassword,
  //       loginCount: 1,
  //       modifiedAt: new Date(),
  //       modifiedBy: {
  //         clientId: ctx.clientId,
  //         userId: ctx.me.id,
  //       },
  //     })
  //   }

  //   // create new authorization token
  //   const token = await createToken(ctx.clientId, me.id)
  //   await (redisClient.pubSub as RedisPubSubEngine<MeUpdatesPayload>).publish(
  //     `${topics.UPDATED_ME}:${ctx.me.id}`,
  //     {
  //       me: toJSON(me),
  //     },
  //   )

  //   return {
  //     viewer: { me: me as Me },
  //     token,
  //   }
  // }

  /**
   * FieldResolvers
   */

  @FieldResolver(() => ID)
  id(@Root() root: Me) {
    return idUtils.encodeRelayId("Me", root.id)
  }

  @FieldResolver(() => CodeshareConnection)
  async codesharesCreated(
    @Root() user: Me,
    @Arg("first", () => Int!) first: number,
    @Arg("after", { nullable: true }) after?: string,
  ): Promise<CodeshareConnection> {
    const signal = new AbortController().signal
    logger.debug("codesharesCreated", { first, after })
    const afterIndex = after ? new Date(idUtils.decodeRelayConnId(after)) : null
    // TODO: validate date
    const [rows, count] = await Promise.all([
      codesharesModel.getBetween(
        r.desc("createdBy.userIdAndModifiedAt"),
        // @ts-ignore
        [
          // @ts-ignore
          [user.id, afterIndex || r.maxval],
          // @ts-ignore
          [user.id, r.minval],
        ].reverse(),
        {
          page: {
            limit: first + 1,
          },
          signal,
        },
      ),
      codesharesModel.countAll("createdBy.userId", user.id, {
        signal,
      }),
    ])

    const edges = []
    for await (const row of rows) {
      edges.push({
        node: {
          ...row,
        } as unknown as Codeshare,
        cursor: idUtils.encodeRelayConnId(row.modifiedAt.toISOString()),
      })
    }

    const hasNextPage = edges.length > first
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
      count: count,
    }
  }

  @FieldResolver(() => UserSettings)
  async settings(@Root() me: Me): Promise<UserSettings> {
    return me.settings || {}
  }
}

function toJSON(user: UserRow): UserJSON {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    modifiedAt: user.modifiedAt.toISOString(),
  }
}

function castDates(user: UserJSON): UserRow {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    modifiedAt: new Date(user.modifiedAt),
  } as UserRow
}

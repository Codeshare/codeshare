import { rateLimit } from './../utils/rateLimit'
import logger from '@codeshare/log'
import 'reflect-metadata'
import AppError from '~/helpers/AppError'
import r from 'rethinkdb'
import { createToken } from '~/models/redisTokenAuths'
import { emailsModel, Row as EmailRow } from '~/models/emails'
import { RegisteredUserRow, UserRow } from '../models/users'
import { ResolverContextType } from './getContext'
import { usersModel, UserModel } from '~/models/users'
import { subscriptionPlansModel } from '~/models/subscriptionPlans'
import {
  Resolver,
  Arg,
  Ctx,
  Root,
  FieldResolver,
  Query,
  Mutation,
  InputType,
  Field,
  ObjectType,
  Subscription,
  ResolverFilterData,
  Info,
  PubSub,
  Publisher,
  ID,
  Int,
  UseMiddleware,
  PubSubEngine,
} from 'type-graphql'
import hashPassword from '~/utils/hashPassword'
import comparePassword from '~/utils/comparePassword'
import idUtils from '@codeshare/id-utils'
import { codesharesModel } from '../models/codeshares'
import { CodeshareConnection } from './nodes/Me'

import Me from './nodes/Me'
import Codeshare from './nodes/Codeshare'
import { GraphQLResolveInfo } from 'graphql'
import Viewer from './nodes/Viewer'
import UserSettings from './fields/UserSettings'
import { ignoreStatus } from 'ignore-errors'
import { tokenAuthsModel } from '../models/redisTokenAuths'
import { anonUsersModel } from '../models/redisAnonUsers'
import { redisClient } from '~/clients/redisClient'
import { withFilter } from 'apollo-server'
import RedisPubSubEngine from 'graphql-ioredis-subscriptions'
import { obj } from 'through2'

/**
 * Subscription Topics & Payloads
 */
enum topics {
  UPDATED_ME = 'UPDATED_ME',
}
interface MeUpdatesPayload {
  me: UserJSON
}
interface MeUpdatesResult {
  viewer: {
    me: UserRow
  }
}

type UserJSON = Omit<UserRow, 'createdAt' | 'modifiedAt'> & {
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
  if (typeof val !== 'object' || val === null) return false
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
  @UseMiddleware(rateLimit('me', 60))
  async me(@Ctx() ctx: ResolverContextType) {
    if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
    const me = await usersModel.getOne('id', ctx.me.id)
    if (!me) {
      throw new AppError("'me' not found", { status: 404, id: ctx.me.id })
    }
    return me
  }

  /**
   * Mutations
   */

  @Mutation(() => ViewerResponse)
  @UseMiddleware(rateLimit('updateMe', 60))
  async updateMe(
    @Arg('input')
    {
      name,
      email: _email,
      password,
      settings,
      defaultCodeshareSettings,
      companyImage,
    }: UpdateMeInput,
    @Ctx() ctx: ResolverContextType,
    // @PubSub(topics.UPDATED_ME)
    // notify: Publisher<MeUpdatesPayload>,
  ): Promise<ViewerResponse> {
    if (!ctx.me) throw new AppError('not authenticated', { status: 401 })

    // ensure email is lowercase
    const lowerEmail = _email?.toLowerCase()

    const allUserUpdateData = {
      ...(settings == null ? {} : { settings }),
    }
    const registeredUserUpdateData = {
      ...(name == null ? {} : { name }),
      ...(lowerEmail == null ? {} : { email: lowerEmail }),
      ...(password == null ? {} : { password }),
    }
    const proUserUpdateData = {
      ...(defaultCodeshareSettings == null ? {} : { defaultCodeshareSettings }),
      ...(companyImage == null ? {} : { companyImage }),
    }
    const hasAllUserUpdates = hasSomeKeys(allUserUpdateData)
    const hasRegisteredUserUpdates = hasSomeKeys(registeredUserUpdateData)
    const hasProUserUpdates = hasSomeKeys(proUserUpdateData)

    /**
     * Basic Data Validation
     * ensure that at least one field is being updated
     */

    if (!hasAllUserUpdates && !hasRegisteredUserUpdates && !hasProUserUpdates) {
      throw new AppError('missing update data', { status: 400 })
    }

    /**
     * Access Control
     * ensure that the user is not trying to update a field that they are not allowed to
     */

    if (hasRegisteredUserUpdates && ctx.me.anonymous) {
      throw new AppError(
        'anonymous users cannot update name, email, or password',
        {
          status: 403,
        },
      )
    }
    if (hasProUserUpdates) {
      // check if user is pro
      const plan = await subscriptionPlansModel.getOne(
        'createdBy.userId',
        ctx.me.id,
      )
      // check if pro plan exists
      AppError.assert(
        plan != null,
        'cannot set default codeshare settings without pro plan',
        {
          status: 403,
        },
      )
      // check if pro plan is not expired
      AppError.assert(
        plan.expiresAt > new Date(),
        'cannot set default codeshare settings without renewing pro plan',
        {
          status: 403,
          code: 'EXPIRED_SUBSCRIBER',
        },
      )
    }

    /**
     * Update Data Validation
     * validate email address
     */

    if (lowerEmail) {
      let emailRow: EmailRow | null = (await emailsModel
        .insert({
          id: lowerEmail,
          createdAt: new Date(),
          createdBy: {
            clientId: ctx.clientId,
            userId: ctx.me.id,
          },
        })
        .catch(ignoreStatus(409))) as EmailRow | null

      if (emailRow == null) {
        // email not inserted, get existing
        emailRow = await emailsModel.getOne('id', lowerEmail)

        if (emailRow == null) {
          // conflict email not found... weird, but just error
          throw new AppError('"email" already exists', { status: 409 })
        }
        if (emailRow.createdBy.userId !== ctx.me.id) {
          // conflict email is not the current user's email
          throw new AppError('"email" already exists', {
            status: 409,
            emailRow,
          })
        }
        // conflict email is the current user's email... do nothing
      } else {
        // email updated, delete any old emails
        await emailsModel.deleteBetween('createdBy.userIdAndCreatedAt', [
          // @ts-ignore
          [ctx.me.id, r.minval],
          [ctx.me.id, emailRow.createdAt],
        ])
      }
    }

    const me = await usersModel.updateOne('id', ctx.me.id, {
      ...allUserUpdateData,
      ...registeredUserUpdateData,
      ...proUserUpdateData,
      modifiedAt: new Date(),
      modifiedBy: {
        clientId: ctx.clientId,
        userId: ctx.me.id,
      },
    })
    ctx.me = me as Me
    await (redisClient.pubSub as RedisPubSubEngine<MeUpdatesPayload>).publish(
      `${topics.UPDATED_ME}:${ctx.me.id}`,
      {
        me: toJSON(me),
      },
    )

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
        AppError.assert(ctx.me, 'not authenticated', { status: 401 })
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
        logger.debug('UPDATED_ME:filter:', {
          payload,
        })
        return true
      },
    ),
  })
  async meUpdates(
    @Root() payload: MeUpdatesPayload,
    @Arg('input') input: MeUpdatesInput,
  ): Promise<MeUpdatesResult> {
    return { viewer: { me: castDates(payload.me) } }
  }

  /**
   * Authentication Mutations
   */

  @Mutation(() => AuthResponse)
  @UseMiddleware(rateLimit('login', 30))
  async login(
    @Arg('input') { email, password }: LoginInput,
    @Ctx() ctx: ResolverContextType,
  ): Promise<AuthResponse> {
    if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
    if (!ctx.me.anonymous) {
      throw new AppError('already logged in', {
        status: 409,
        userId: ctx.me.id,
      })
    }
    const oldMe = ctx.me

    // find email
    const emailRow = await emailsModel.getOne('id', email)
    if (!emailRow) {
      throw new AppError('invalid login', {
        status: 404,
        email,
        code: 'email not found',
      })
    }
    // find user with email
    const userRow = await usersModel.getOne('id', emailRow.createdBy.userId)
    if (!userRow)
      throw new AppError(
        'Your account is inactive. Please reset your password.',
        { status: 500, email },
      )
    // verify password
    const registeredUserRow = userRow as RegisteredUserRow
    const passwordIsCorrect = await comparePassword(
      password,
      registeredUserRow.password,
    )
    if (!passwordIsCorrect) {
      throw new AppError('invalid login', {
        status: 404,
        email,
        code: 'invalid password',
      })
    }
    // create new authorization token
    const token = await createToken(ctx.clientId, registeredUserRow.id)
    // find user with email
    await usersModel.incLoginCount('id', emailRow.createdBy.userId, {
      modifiedAt: new Date(),
      modifiedBy: {
        clientId: ctx.clientId,
        userId: ctx.me.id,
      },
    })
    registeredUserRow.loginCount++
    const me = userRow as Me

    // delete old anon user and token
    await Promise.all<unknown>([
      tokenAuthsModel.deleteOneByToken(ctx.token),
      // delete anon user
      usersModel.deleteOne('id', oldMe.id),
    ])

    return {
      viewer: { me },
      token,
    }
  }

  @Mutation(() => AuthResponse)
  @UseMiddleware(rateLimit('deleteMe', 30))
  async deleteMe(
    @Arg('input') input: DeleteMeInput,
    @Ctx() ctx: ResolverContextType,
  ): Promise<AuthResponse> {
    if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
    if (ctx.me.anonymous) {
      // anon user to delete
      return {
        viewer: { me: ctx.me },
        token: ctx.token,
      }
    }
    await Promise.all([
      usersModel.deleteOne('id', ctx.me.id),
      codesharesModel.deleteAll('createdBy.userId', ctx.me.id),
      emailsModel.deleteAll('createdBy.userId', ctx.me.id),
      tokenAuthsModel.deleteOneByToken(ctx.token),
    ])
    // TODO: disconnect socket?
    ctx.me = null
    return this.registerAnonymous(ctx, {})
  }

  @Mutation(() => AuthResponse)
  @UseMiddleware(rateLimit('logout', 30))
  async logout(
    @Arg('input') input: LogoutInput,
    @Ctx() ctx: ResolverContextType,
  ): Promise<AuthResponse> {
    if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
    if (ctx.me.anonymous) {
      // anon user no need to logout
      return {
        viewer: { me: ctx.me },
        token: ctx.token,
      }
    }
    // TODO: disconnect socket?
    ctx.me = null
    const [auth] = await Promise.all([
      this.registerAnonymous(ctx, {}),
      // delete old auth only, user is not anon.. they are authed and logging out
      tokenAuthsModel.deleteOneByToken(ctx.token),
    ])

    return auth
  }

  @Mutation(() => AuthResponse)
  @UseMiddleware(rateLimit('register', 30))
  async register(
    @Arg('input')
    { email, password, name, settings, clientMutationId }: RegisterInput,
    @Ctx() ctx: ResolverContextType,
    // @PubSub(topics.UPDATED_ME)
    // notify: Publisher<MeUpdatesPayload>,
  ): Promise<AuthResponse> {
    if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
    if (!ctx.me.anonymous) {
      throw new AppError('already registered', {
        status: 409,
        email,
        clientId: ctx.clientId,
        userId: ctx.me.id,
      })
    }
    const registeredUserId = UserModel.removeAnonNamespace(ctx.me.id)
    // register email address
    try {
      await emailsModel.insert({
        id: email.toLowerCase(),
        createdAt: new Date(),
        createdBy: {
          clientId: ctx.clientId,
          userId: registeredUserId,
        },
      })
    } catch (e) {
      const err = e as AppError
      if (err.status === 409) {
        try {
          return await this.login({ email, password }, ctx)
        } catch (e) {
          const err = e as AppError
          throw AppError.wrap(err, 'user with email already exists', {
            status: 409,
            email,
            clientId: ctx.clientId,
            userId: ctx.me.id,
          })
        }
      }
    }
    // update anon user to registered user
    const settingsUpdates = settings == null ? {} : { settings }
    const hashedPassword = await hashPassword(password)
    let me
    if (UserModel.isAnonId(ctx.me.id)) {
      me = await usersModel.insert({
        id: registeredUserId,
        anonymous: false,
        name,
        password: hashedPassword,
        loginCount: 1,
        ...settingsUpdates,
        createdAt: ctx.me.createdAt,
        modifiedAt: new Date(),
        modifiedBy: {
          clientId: ctx.clientId,
          userId: ctx.me.id,
        },
      })
      // migrate anon created codeshares
      codesharesModel.migrate(ctx.me.id, {
        createdBy: {
          clientId: ctx.clientId,
          userId: me.id, // registered id
        },
        modifiedAt: new Date(),
        modifiedBy: {
          clientId: ctx.clientId,
          userId: ctx.me.id,
        },
      })
    } else {
      logger.error('unexpected rethinkdb user registration', {
        err: new AppError<{ userId: string }>(
          'unexpected rethinkdb user registration',
          {
            status: 500,
            userId: ctx.me.id,
          },
        ),
      })
      me = await usersModel.updateOne('id', ctx.me.id, {
        anonymous: false,
        name,
        password: hashedPassword,
        loginCount: 1,
        modifiedAt: new Date(),
        modifiedBy: {
          clientId: ctx.clientId,
          userId: ctx.me.id,
        },
      })
    }

    // create new authorization token
    const token = await createToken(ctx.clientId, me.id)
    await (redisClient.pubSub as RedisPubSubEngine<MeUpdatesPayload>).publish(
      `${topics.UPDATED_ME}:${ctx.me.id}`,
      {
        me: toJSON(me),
      },
    )

    return {
      viewer: { me: me as Me },
      token,
    }
  }

  @Mutation(() => AuthResponse)
  @UseMiddleware(rateLimit('registerAnonymous', 30))
  async registerAnonymous(
    @Ctx() ctx: ResolverContextType,
    @Arg('input') input: RegisterAnonymousInput,
  ): Promise<AuthResponse> {
    if (ctx.me) throw new AppError('already authenticated', { status: 400 })

    const userId = UserModel.genAnonId()
    // create new authorization token
    const token = await createToken(ctx.clientId, userId)
    // register anon user
    const me = await anonUsersModel.upsert({
      id: userId,
      token: token,
    })

    return {
      viewer: { me: me as Me },
      token,
    }
  }

  /**
   * FieldResolvers
   */

  @FieldResolver(() => ID)
  id(@Root() root: Me) {
    return idUtils.encodeRelayId('Me', root.id)
  }

  @FieldResolver(() => CodeshareConnection)
  async codesharesCreated(
    @Root() user: Me,
    @Arg('first', () => Int!) first: number,
    @Arg('after', { nullable: true }) after?: string,
  ): Promise<CodeshareConnection> {
    const signal = new AbortController().signal
    logger.debug('codesharesCreated', { first, after })
    const afterIndex = after ? new Date(idUtils.decodeRelayConnId(after)) : null
    // TODO: validate date
    const [rows, count] = await Promise.all([
      codesharesModel.getBetween(
        r.desc('createdBy.userIdAndModifiedAt'),
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
      codesharesModel.countAll('createdBy.userId', user.id, {
        signal,
      }),
    ])

    const edges = []
    for await (let row of rows) {
      edges.push({
        node: ({
          ...row,
        } as unknown) as Codeshare,
        cursor: idUtils.encodeRelayConnId(row.modifiedAt.toISOString()),
      })
    }

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

import { ResolverContextType } from './getContext'
import idUtils from '@codeshare/id-utils'
import User from '~/graphql/nodes/User'
import { Arg, Ctx, Root, FieldResolver, ID, Int, Resolver } from 'type-graphql'
import { emailsModel } from '~/models/emails'
import r from 'rethinkdb'
import { ignoreMessage } from 'ignore-errors'
import {
  SubscriptionPlanConnection,
  SubscriptionPlan,
} from './nodes/SubscriptionPlan'
import { subscriptionPlansModel } from '~/models/subscriptionPlans'
import isAdminEmail from '~/graphql/isAdmin'

/**
 * Resolver
 */
@Resolver(() => User)
export default class UserResolver {
  /**
   * FieldResolvers
   */

  @FieldResolver(() => ID)
  id(@Root() root: User) {
    return idUtils.encodeRelayId('User', root.id)
  }

  @FieldResolver()
  async email(@Root() root: User, @Ctx() ctx: ResolverContextType) {
    if (root.anonymous) return null
    const meEmailRow = await emailsModel.getOne(
      'createdBy.userId',
      ctx.me?.id ?? '',
    )
    const gen = await emailsModel.getBetween(
      r.desc('createdBy.userIdAndCreatedAt'),
      isAdminEmail(meEmailRow?.id ?? '')
        ? [
            // @ts-ignore
            [root.id, r.minval],
            // @ts-ignore
            [root.id, r.maxval],
          ]
        : [
            // @ts-ignore
            [ctx.me.id, r.minval],
            // @ts-ignore
            [ctx.me.id, r.maxval],
          ],
      {
        signal: new AbortController().signal,
      },
    )
    const { value: row } = await gen.next()
    gen.return().catch(ignoreMessage(/./))
    return row?.id
  }

  @FieldResolver(() => SubscriptionPlanConnection)
  async subscriptionPlans(
    @Root() user: User,
    @Arg('first', () => Int!) first: number,
    @Arg('after', { nullable: true }) after?: string,
  ): Promise<SubscriptionPlanConnection> {
    const afterIndex = after ? new Date(idUtils.decodeRelayConnId(after)) : null
    // TODO: validate date
    const rows = await subscriptionPlansModel.getBetween(
      r.desc('createdBy.userIdAndExpiresAt'),
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
        signal: new AbortController().signal,
      },
    )

    const edges = []
    for await (let row of rows) {
      edges.push({
        node: ({
          ...row,
        } as unknown) as SubscriptionPlan,
        cursor: idUtils.encodeRelayConnId(row.expiresAt.toISOString()),
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
          ? idUtils.encodeRelayConnId(startEdge.node.expiresAt.toISOString())
          : undefined,
        endCursor: endEdge
          ? idUtils.encodeRelayConnId(endEdge.node.expiresAt.toISOString())
          : undefined,
        hasNextPage,
        hasPreviousPage: Boolean(after),
      },
      count: edges.length,
    }
  }
}
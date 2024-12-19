import idUtils from "@codeshare/id-utils"
import isAdminEmail from "~/graphql/isAdmin"
import User from "~/graphql/nodes/User"
import { emailsModel } from "~/models/emails"
import { subscriptionPlansModel } from "~/models/subscriptionPlans"
import { ignoreMessage } from "ignore-errors"
import r from "rethinkdb"
import { Arg, Ctx, FieldResolver, ID, Int, Resolver, Root } from "type-graphql"

import { ResolverContextType } from "./getContext"
import {
  SubscriptionPlan,
  SubscriptionPlanConnection,
} from "./nodes/SubscriptionPlan"

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
    return idUtils.encodeRelayId("User", root.id)
  }

  @FieldResolver()
  async email(@Root() root: User, @Ctx() ctx: ResolverContextType) {
    if (root.anonymous) return null
    const meEmailRow = await emailsModel.getOne(
      "createdBy.userId",
      ctx.me?.id ?? "",
    )
    const gen = await emailsModel.getBetween(
      r.desc("createdBy.userIdAndCreatedAt"),
      isAdminEmail(meEmailRow?.id ?? "")
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
    @Arg("first", () => Int!) first: number,
    @Arg("after", { nullable: true }) after?: string,
  ): Promise<SubscriptionPlanConnection> {
    const afterIndex = after ? new Date(idUtils.decodeRelayConnId(after)) : null
    // TODO: validate date
    const rows = await subscriptionPlansModel.getBetween(
      r.desc("createdBy.userIdAndExpiresAt"),
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
    for await (const row of rows) {
      edges.push({
        node: {
          ...row,
        } as unknown as SubscriptionPlan,
        cursor: idUtils.encodeRelayConnId(row.expiresAt.toISOString()),
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

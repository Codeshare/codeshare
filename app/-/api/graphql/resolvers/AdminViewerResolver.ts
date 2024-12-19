import isAdminEmail from "@/app/-/api/graphql/isAdmin"
import {
  SubscriptionPlan,
  SubscriptionPlanConnection,
  SubscriptionPlanEdge,
} from "@/app/-/api/graphql/nodes/SubscriptionPlan"
import Viewer from "@/app/-/api/graphql/nodes/Viewer"
import idUtils from "@codeshare/id-utils"
import logger from "@codeshare/log"
import { ResolverContextType } from "~/graphql/getContext"
import { emailsModel } from "~/models/emails"
import { planIds, subscriptionPlansModel } from "~/models/subscriptionPlans"
import { GraphQLResolveInfo } from "graphql"
import r from "rethinkdb"
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Info,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql"
import { v4 } from "uuid"

import AppError from "@/lib/common/AppError"

import Context from "./nodes/Context"

const DAY = 24 * 60 * 60 * 1000
const YEAR = DAY * 365

@InputType()
class CreateSubscriptionPlanInput {
  @Field()
  email!: string
  @Field()
  expiresAt!: string
  @Field({ nullable: true })
  clientMutationId?: string
}

@InputType()
class UpdateSubscriptionPlanInput {
  @Field()
  id!: string
  @Field()
  expiresAt!: string
  @Field({ nullable: true })
  clientMutationId?: string
}

@ObjectType()
export class CreateSubscriptionPlanResponse {
  @Field(() => SubscriptionPlanEdge)
  subscriptionEdge!: SubscriptionPlanEdge
}
@ObjectType()
export class UpdateSubscriptionPlanResponse {
  @Field(() => SubscriptionPlanEdge)
  subscriptionEdge!: SubscriptionPlanEdge
}

@Resolver(() => Viewer)
export default class AdminViewerResolver {
  @Query(() => Context)
  async context(@Ctx() ctx: ResolverContextType) {
    logger.debug("context", {})

    AppError.assert(ctx.me, "not authenticated", { status: 401 })
    AppError.assert(!ctx.me.anonymous, "access denied", {
      status: 403,
      userId: ctx.me.id,
      clientId: ctx.clientId,
    })

    const emailRow = await emailsModel.getOne("createdBy.userId", ctx.me.id)
    AppError.assert(emailRow, "access denied", { status: 403 })

    const email = emailRow.id
    AppError.assert(isAdminEmail(email), "access denied", { status: 403 })

    return ctx
  }

  /**
   * ADMIN Mutations
   */

  @Mutation(() => CreateSubscriptionPlanResponse)
  async createSubscriptionPlan(
    @Arg("input") input: CreateSubscriptionPlanInput,
    @Ctx() ctx: ResolverContextType,
    @Info() info: GraphQLResolveInfo,
  ) {
    logger.debug("subscriptionPlans", {})
    AppError.assert(ctx.me, "not authenticated", { status: 401 })
    AppError.assert(!ctx.me.anonymous, "access denied", {
      status: 403,
      userId: ctx.me.id,
      clientId: ctx.clientId,
    })

    const { email, expiresAt } = input
    logger.debug("createSubscriptionPlan", { email, expiresAt })

    const adminEmailRow = await emailsModel.getOne(
      "createdBy.userId",
      ctx.me.id,
    )
    AppError.assert(adminEmailRow, "access denied", { status: 403 })
    const adminEmail = adminEmailRow.id
    AppError.assert(isAdminEmail(adminEmail), "access denied", { status: 403 })

    const customerEmailRow = await emailsModel.getOne("id", email)
    AppError.assert(customerEmailRow, "email not found", { status: 404 })

    const customerUserId = customerEmailRow.createdBy.userId

    const existingSubscriptionPlan = await subscriptionPlansModel.getOne(
      "createdBy.userId",
      customerUserId,
    )
    AppError.assert(
      existingSubscriptionPlan == null,
      "subscription plan already exists",
      { status: 409 },
    )

    const stripeCustomerId = "manual:" + v4()
    const subscriptionPlan = await subscriptionPlansModel.insert({
      id: stripeCustomerId,
      createdAt: new Date(),
      expiresAt: new Date(expiresAt),
      modifiedAt: new Date(),
      modifiedBy: {
        userId: customerUserId,
        clientId: ctx.clientId,
      },
      createdBy: {
        userId: customerUserId,
        clientId: ctx.clientId,
      },
      stripePlanId: planIds.PRO_49,
      stripeCustomerId: stripeCustomerId,
      stripeSubscription: {},
    })

    return {
      subscriptionEdge: {
        node: subscriptionPlan,
        cursor: idUtils.encodeRelayConnId(
          subscriptionPlan.expiresAt.toISOString(),
        ),
      },
    }
  }

  @Mutation(() => UpdateSubscriptionPlanResponse)
  async updateSubscriptionPlan(
    @Arg("input") input: UpdateSubscriptionPlanInput,
    @Ctx() ctx: ResolverContextType,
    @Info() info: GraphQLResolveInfo,
  ) {
    logger.debug("subscriptionPlans", {})
    AppError.assert(ctx.me, "not authenticated", { status: 401 })
    AppError.assert(!ctx.me.anonymous, "access denied", {
      status: 403,
      userId: ctx.me.id,
      clientId: ctx.clientId,
    })

    const id = idUtils.decodeRelayId("SubscriptionPlan", input.id)
    const { expiresAt } = input
    logger.debug("updateSubscriptionPlan", { id, expiresAt })

    const emailRow = await emailsModel.getOne("createdBy.userId", ctx.me.id)
    AppError.assert(emailRow, "access denied", { status: 403 })

    const email = emailRow.id
    AppError.assert(isAdminEmail(email), "access denied", { status: 403 })

    const subscriptionPlan = await subscriptionPlansModel.updateOne("id", id, {
      expiresAt: new Date(expiresAt),
      modifiedAt: new Date(),
      modifiedBy: {
        userId: ctx.me.id,
        clientId: ctx.clientId,
      },
    })

    if (!subscriptionPlan) {
      throw new AppError("'subscriptionPlan' not found", { status: 404, id })
    }

    return {
      subscriptionEdge: {
        node: subscriptionPlan,
        cursor: idUtils.encodeRelayConnId(
          subscriptionPlan.expiresAt.toISOString(),
        ),
      },
    }
  }

  /**
   *  ADMIN FieldResolvers
   */
  @FieldResolver(() => SubscriptionPlanConnection)
  async subscriptionPlans(
    @Ctx() ctx: ResolverContextType,
    @Root() viewer: Viewer,
    @Arg("first", () => Int!) first: number,
    @Arg("after", { nullable: true }) after?: string,
  ): Promise<SubscriptionPlanConnection> {
    logger.debug("subscriptionPlans", { first, after })
    AppError.assert(ctx.me, "not authenticated", { status: 401 })
    AppError.assert(!ctx.me.anonymous, "access denied", {
      status: 403,
      userId: ctx.me.id,
      clientId: ctx.clientId,
    })

    const emailRow = await emailsModel.getOne("createdBy.userId", ctx.me.id)
    AppError.assert(emailRow, "access denied", {
      status: 403,
      userId: ctx.me.id,
      clientId: ctx.clientId,
    })

    const email = emailRow.id
    AppError.assert(isAdminEmail(email), "access denied", {
      status: 403,
      email,
      userId: ctx.me.id,
      clientId: ctx.clientId,
    })

    const afterIndex = after ? new Date(idUtils.decodeRelayConnId(after)) : null
    // TODO: validate date
    const rows = await subscriptionPlansModel.getBetween(
      r.desc("createdAt"),
      // @ts-ignore
      [
        // @ts-ignore
        afterIndex || r.maxval,
        // @ts-ignore
        r.minval,
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
        cursor: idUtils.encodeRelayConnId(row.createdAt.toISOString()),
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
          ? idUtils.encodeRelayConnId(startEdge.node.createdAt.toISOString())
          : undefined,
        endCursor: endEdge
          ? idUtils.encodeRelayConnId(endEdge.node.createdAt.toISOString())
          : undefined,
        hasNextPage,
        hasPreviousPage: Boolean(after),
      },
      count: edges.length,
    }
  }
}

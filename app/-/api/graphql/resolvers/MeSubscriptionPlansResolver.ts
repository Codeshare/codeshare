import { rateLimit } from "./../utils/rateLimit"

import "reflect-metadata"

import idUtils from "@codeshare/id-utils"
import AppError from "~/helpers/AppError"
import { customersModel } from "~/models/customers"
import { emailsModel } from "~/models/emails"
import { planIds, subscriptionPlansModel } from "~/models/subscriptionPlans"
import r from "rethinkdb"
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql"

import { ResolverContextType } from "./getContext"
import Me from "./nodes/Me"
import {
  SubscriptionPlan,
  SubscriptionPlanConnection,
  SubscriptionPlanEdge,
} from "./nodes/SubscriptionPlan"
import User from "./nodes/User"

const DAY = 24 * 60 * 60 * 1000
const YEAR = DAY * 365

@InputType()
class SubscribeToCodeshareProInput {
  @Field()
  stripePaymentMethodId!: string
  @Field({ nullable: true })
  clientMutationId?: string
}

@ObjectType()
export class SubscribeToCodeshareProPayload {
  @Field()
  me!: Me
  @Field(() => SubscriptionPlanEdge)
  subscriptionEdge!: SubscriptionPlanEdge
}

@Resolver(() => SubscriptionPlan)
export class MeSubscriptionFieldResolver {
  /**
   * FieldResolvers
   */

  @FieldResolver(() => ID)
  id(@Root() root: SubscriptionPlan) {
    return idUtils.encodeRelayId("SubscriptionPlan", root.id)
  }
}

@Resolver(() => Me)
export default class MeSubscriptionResolver {
  /**
   * Mutations
   */

  @Mutation(() => SubscribeToCodeshareProPayload)
  @UseMiddleware(rateLimit("subscribeToCodesharePro", 30))
  async subscribeToCodesharePro(
    @Arg("input") { stripePaymentMethodId }: SubscribeToCodeshareProInput,
    @Ctx() ctx: ResolverContextType,
  ) {
    AppError.assert(ctx.me, "not authenticated", { status: 401 })
    AppError.assert(!ctx.me.anonymous, "not registered", { status: 400 })
    let [email, customer, subscriptionPlan] = await Promise.all([
      emailsModel.getOne("createdBy.userId", ctx.me.id),
      customersModel.getOne("createdBy.userId", ctx.me.id),
      subscriptionPlansModel.getOne("createdBy.userId", ctx.me.id),
    ])

    const expiresAt = subscriptionPlan?.expiresAt
    if (expiresAt != null && expiresAt > new Date()) {
      throw new AppError("you are already subscribed", {
        status: 409,
        email: email?.id,
        clientId: ctx.clientId,
        userId: ctx.me.id,
        expiresAt,
        date: new Date(),
      })
    }
    AppError.assert(email, "email is missing (unexpected)", { status: 500 })

    if (customer && subscriptionPlan) {
      ;[customer, subscriptionPlan] = await Promise.all([
        customersModel.updateStripeCustomer(
          customer.stripeCustomer.id,
          email.id,
          {
            modifiedAt: new Date(),
            modifiedBy: {
              userId: ctx.me.id,
              clientId: ctx.clientId,
            },
            stripePaymentMethodId,
          },
        ),
        subscriptionPlansModel.updateOne("id", subscriptionPlan.id, {
          expiresAt: new Date(Date.now() + 2 * YEAR),
          modifiedAt: new Date(),
          modifiedBy: {
            userId: ctx.me.id,
            clientId: ctx.clientId,
          },
        }),
      ])
    } else {
      customer = await customersModel.insertStripeCustomer(email.id, {
        id: ctx.me.id,
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
        stripePaymentMethodId,
      })
      subscriptionPlan = await subscriptionPlansModel.insertStripeSubscription({
        createdAt: new Date(),
        createdBy: {
          userId: ctx.me.id,
          clientId: ctx.clientId,
        },
        expiresAt: new Date(Date.now() + 2 * YEAR),
        modifiedAt: new Date(),
        modifiedBy: {
          userId: ctx.me.id,
          clientId: ctx.clientId,
        },
        stripeCustomerId: customer.stripeCustomer.id,
        stripePlanId: planIds.PRO_49,
      })
    }

    return {
      me: ctx.me,
      subscriptionEdge: {
        node: subscriptionPlan,
        cursor: idUtils.encodeRelayConnId(
          subscriptionPlan.expiresAt.toISOString(),
        ),
      },
    }
  }
}

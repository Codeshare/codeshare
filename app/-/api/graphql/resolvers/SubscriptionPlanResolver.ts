import idUtils from '@codeshare/id-utils'
import { SubscriptionPlan } from '~/graphql/nodes/SubscriptionPlan'
import { FieldResolver, ID, Resolver, Root } from 'type-graphql'

/**
 * Resolver
 */
@Resolver(() => SubscriptionPlan)
export default class SubscriptionPlanResolver {
  /**
   * FieldResolvers
   */

  @FieldResolver(() => ID)
  id(@Root() root: SubscriptionPlan) {
    return idUtils.encodeRelayId('SubscriptionPlan', root.id)
  }

  @FieldResolver()
  async isActive(@Root() root: SubscriptionPlan) {
    return root.expiresAt > new Date()
  }

  @FieldResolver()
  async planId(@Root() root: SubscriptionPlan) {
    return (root as any).stripePlanId as string
  }
}

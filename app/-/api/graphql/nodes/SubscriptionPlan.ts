import {
  IsBoolean,
  IsDate,
  IsDefined,
  IsEnum,
  IsOptional,
  MaxLength,
} from "class-validator"
import { Field, ObjectType } from "type-graphql"

import { planIds } from "@/lib/models/subscriptionPlansModel"

import Connection from "./fields/Connection"
import CreatedBy from "./fields/CreatedBy"
import Edge from "./fields/Edge"
import ModifiedBy from "./fields/ModifiedBy"
import Node from "./Node"

@ObjectType({ description: "The subscription model", implements: Node })
export class SubscriptionPlan extends Node {
  @Field()
  @IsDefined()
  @IsDate()
  createdAt!: Date
  @Field(() => CreatedBy) // circular
  @IsDefined()
  createdBy!: CreatedBy
  @Field()
  @IsDefined()
  @IsDate()
  expiresAt!: Date
  @Field()
  @IsDefined()
  @IsBoolean()
  isActive!: boolean
  @Field()
  @IsDefined()
  @IsDate()
  modifiedAt!: Date
  @Field(() => ModifiedBy) // circular
  @IsDefined()
  modifiedBy!: ModifiedBy
  @Field()
  @IsDefined()
  @IsEnum(planIds)
  planId!: string
}

@ObjectType({ implements: Edge })
export class SubscriptionPlanEdge extends Edge {
  @Field(() => SubscriptionPlan)
  @IsDefined()
  node!: SubscriptionPlan
  @Field()
  @IsDefined()
  @MaxLength(256)
  cursor!: string
}

@ObjectType({ implements: Edge })
class SubscriptionPlanConnectionEdge extends Edge {
  @Field(() => SubscriptionPlan, { nullable: true })
  @IsOptional()
  node!: SubscriptionPlan | null
  @Field()
  @IsDefined()
  @MaxLength(256)
  cursor!: string
}

@ObjectType({ implements: Connection })
export class SubscriptionPlanConnection extends Connection {
  @Field(() => [SubscriptionPlanConnectionEdge!])
  @IsDefined()
  edges!: SubscriptionPlanConnectionEdge[]
}

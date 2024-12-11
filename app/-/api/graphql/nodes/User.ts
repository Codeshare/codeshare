import 'reflect-metadata'

import { Field, Int, ObjectType } from 'type-graphql'
import {
  IsBoolean,
  IsDate,
  IsDefined,
  IsNumber,
  IsOptional,
  MaxLength,
} from 'class-validator'

import ModifiedBy from './fields/ModifiedBy'
import Node from './Node'
import { SubscriptionPlanConnection } from './SubscriptionPlan'
import UserSettings from './fields/UserSettings'

@ObjectType({ description: 'The user model', implements: Node })
export default class User extends Node {
  @Field()
  @IsDefined()
  @IsBoolean()
  anonymous!: boolean
  @Field()
  @IsDefined()
  @IsDate()
  createdAt!: Date
  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(256)
  email?: string
  @Field(() => Int!)
  @IsDefined()
  @IsNumber()
  loginCount!: number
  @Field()
  @IsDefined()
  @IsDate()
  modifiedAt!: Date
  @Field()
  @IsDefined()
  modifiedBy!: ModifiedBy
  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(256)
  name?: string
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  registeredAt?: Date
  @Field()
  @IsDefined()
  settings!: UserSettings
  @Field(() => SubscriptionPlanConnection)
  @IsDefined()
  subscriptionPlans!: SubscriptionPlanConnection
  @Field({ nullable: true })
  @IsOptional()
  companyImage?: string
}

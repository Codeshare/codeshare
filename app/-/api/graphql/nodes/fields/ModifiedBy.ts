import 'reflect-metadata'

import { Field, ObjectType } from 'type-graphql'

import User from '../nodes/User'

@ObjectType({ description: 'Modified by user' })
export default class ModifiedBy {
  @Field()
  clientId!: string
  @Field()
  me!: boolean
  @Field(() => User)
  user!: User
  @Field()
  userId!: string
}

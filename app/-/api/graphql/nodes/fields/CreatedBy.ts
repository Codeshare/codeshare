import 'reflect-metadata'

import { Field, ObjectType } from 'type-graphql'

import User from '../nodes/User'

@ObjectType({ description: 'Created by user' })
export default class CreatedBy {
  @Field()
  clientId!: string
  @Field()
  me!: boolean
  @Field(() => User)
  user!: User
  @Field()
  userId!: string
}

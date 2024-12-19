import "reflect-metadata"

import User from "@/app/-/api/graphql/nodes/nodes/User"
import { Field, ObjectType } from "type-graphql"

@ObjectType({ description: "Modified by user" })
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

import "reflect-metadata"

import { Field, ObjectType } from "type-graphql"

// Note: make sure this matches nodes/Codeshare and models/Codeshare
@ObjectType({ description: "User default codeshare settings" })
export default class UserDefaultCodeshareSettings {
  @Field({ nullable: true })
  modeName?: string
  @Field({ nullable: true })
  tabSize?: string
}

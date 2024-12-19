import "reflect-metadata"

import { Field, ObjectType } from "type-graphql"

@ObjectType({ description: "User settings" })
export default class UserSettings {
  @Field({ nullable: true })
  keymap?: string
  @Field({ nullable: true })
  theme?: string
}

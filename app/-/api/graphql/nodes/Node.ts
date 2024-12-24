import logger from "@codeshare/log"
import { IsDefined, IsOptional, MaxLength } from "class-validator"
import { Field, ID, InterfaceType } from "type-graphql"

@InterfaceType({
  resolveType: (value) => {
    logger.trace("VALUE", value)
    if (value?.typeName === "User")
      return import("../nodes/User").then((m) => m.default)
    if (value?.typeName === "Me")
      return import("../nodes/Me").then((m) => m.default)
    if (value?.typeName === "Codeshare")
      return import("../nodes/Codeshare").then((m) => m.default)
  },
})
export default class Node {
  @Field(() => ID)
  @IsDefined()
  @MaxLength(256)
  id!: string
  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(100)
  typeName?: string
}

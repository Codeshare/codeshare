import { ResolverContextType } from "@/app/-/api/graphql/nodes/getContext"
import User from "~/graphql/nodes/User"
import { anonUser, UserRow, usersModel } from "~/models/users"

import "reflect-metadata"

import { Ctx, FieldResolver, Resolver, Root } from "type-graphql"

import ModifiedBy from "./ModifiedBy"

@Resolver(() => ModifiedBy)
export default class ModifiedByFieldResolver {
  @FieldResolver()
  me(@Root() modifiedBy: ModifiedBy, @Ctx() ctx: ResolverContextType) {
    return modifiedBy.userId === ctx.me?.id
  }
  @FieldResolver(() => User)
  async user(@Root() modifiedBy: ModifiedBy): Promise<UserRow> {
    const user = await usersModel.getOne("id", modifiedBy.userId)
    return user ?? anonUser(modifiedBy.userId)
  }
}

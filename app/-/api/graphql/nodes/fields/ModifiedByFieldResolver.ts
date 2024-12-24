import User from "@/app/-/api/graphql/nodes/User"
import { type ResolverContextType } from "@/app/-/api/graphql/resolvers/getContext"

import usersModel, { anonUser, UserRow } from "@/lib/models/usersModel"

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

    // HACK: fix me later
    return (user ?? anonUser(modifiedBy.userId)) as UserRow
  }
}

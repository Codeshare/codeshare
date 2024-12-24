import User from "@/app/-/api/graphql/nodes/User"
import { type ResolverContextType } from "@/app/-/api/graphql/resolvers/getContext"

import usersModel, { anonUser, UserRow } from "@/lib/models/usersModel"

import "reflect-metadata"

import { Ctx, FieldResolver, Resolver, Root } from "type-graphql"

import CreatedBy from "./CreatedBy"

@Resolver(() => CreatedBy)
export default class CreatedByFieldResolver {
  @FieldResolver()
  me(@Root() createdBy: CreatedBy, @Ctx() ctx: ResolverContextType) {
    return createdBy.userId === ctx.me?.id
  }
  @FieldResolver(() => User)
  async user(@Root() createdBy: CreatedBy): Promise<UserRow> {
    const user = await usersModel.getOne("id", createdBy.userId)

    // HACK: fix me later
    return (user ?? anonUser(createdBy.userId)) as UserRow
  }
}

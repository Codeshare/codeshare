import { ResolverContextType } from "@/app/-/api/graphql/nodes/getContext"
import User from "~/graphql/nodes/User"
import { anonUser, UserRow, usersModel } from "~/models/users"

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
    return user ?? anonUser(createdBy.userId)
  }
}

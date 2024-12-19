import { ResolverContextType } from "~/graphql/getContext"
import Viewer from "~/graphql/nodes/Viewer"
import AppError from "~/helpers/AppError"
import { usersModel } from "~/models/users"
import { rateLimit } from "~/utils/rateLimit"
import { Ctx, Query, Resolver, UseMiddleware } from "type-graphql"

@Resolver(() => Viewer)
export default class ViewerResolver {
  /**
   * Queries
   */
  @Query(() => Viewer)
  @UseMiddleware(rateLimit("viewer", 60))
  async viewer(@Ctx() ctx: ResolverContextType) {
    if (!ctx.me) throw new AppError("not authenticated", { status: 401 })
    const me = await usersModel.getOne("id", ctx.me.id)
    if (!me) {
      throw new AppError("'me' not found", { status: 404, id: ctx.me.id })
    }
    return { me }
  }
}

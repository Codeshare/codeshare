import { Ctx, Query, Resolver, UseMiddleware } from 'type-graphql'
import Viewer from '~/graphql/nodes/Viewer'
import { rateLimit } from '~/utils/rateLimit'
import AppError from '~/helpers/AppError'
import { usersModel } from '~/models/users'
import { ResolverContextType } from '~/graphql/getContext'

@Resolver(() => Viewer)
export default class ViewerResolver {
  /**
   * Queries
   */
  @Query(() => Viewer)
  @UseMiddleware(rateLimit('viewer', 60))
  async viewer(@Ctx() ctx: ResolverContextType) {
    if (!ctx.me) throw new AppError('not authenticated', { status: 401 })
    const me = await usersModel.getOne('id', ctx.me.id)
    if (!me) {
      throw new AppError("'me' not found", { status: 404, id: ctx.me.id })
    }
    return { me }
  }
}

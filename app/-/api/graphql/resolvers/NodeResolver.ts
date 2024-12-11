import { rateLimit } from './../utils/rateLimit'
import logger from '@codeshare/log'
import { usersModel } from '~/models/users'
import AppError from '~/helpers/AppError'
import { ResolverContextType } from './getContext'
import { Arg, Ctx, Query, UseMiddleware } from 'type-graphql'
import Node from './nodes/Node'
import { ID } from 'type-graphql'
import { fromGlobalId } from 'graphql-relay'
import { codesharesModel } from '~/models/codeshares'

export default class NodeResolver {
  // @FieldResolver(() => ID)
  // id(root: any) {
  //   return idUtils.encodeRelayId(camelize(root.__tableName, true), root.id)
  // }
  @Query(() => Node, { nullable: true })
  @UseMiddleware(rateLimit('node', 60))
  async node(
    @Ctx() ctx: ResolverContextType,
    @Arg('id', () => ID) globalId: string,
  ): Promise<Node | null> {
    if (!ctx.me) throw new AppError('not authenticated', { status: 401 })

    const data = fromGlobalId(globalId)
    logger.debug('query node', { globalId, data })
    const id = data.id
    const type = data.type
    if (type === 'User') {
      const user = await usersModel.getOne('id', id)
      // @ts-ignore
      if (user) user.typeName = 'User'
      return user as Node
    } else if (type === 'Me') {
      const user = await usersModel.getOne('id', id)
      // @ts-ignore
      if (user) user.typeName = 'Me'
      return user as Node
    } else if (type === 'Codeshare') {
      const codeshare = await codesharesModel.getOne('id', id)
      // @ts-ignore
      if (codeshare) codeshare.typeName = 'Codeshare'
      return codeshare as Node
    }
    return null
  }
}
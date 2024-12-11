import 'reflect-metadata'

import { Field, Int, InterfaceType, ObjectType } from 'type-graphql'

@ObjectType()
class PageInfo {
  @Field()
  hasNextPage!: boolean
  @Field()
  hasPreviousPage!: boolean
  @Field({ nullable: true })
  startCursor?: string
  @Field({ nullable: true })
  endCursor?: string
}

@InterfaceType()
export default class Connection {
  @Field()
  pageInfo!: PageInfo
  @Field(() => Int!)
  count!: number
}

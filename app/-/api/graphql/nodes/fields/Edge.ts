import { Field, InterfaceType } from 'type-graphql'

import Node from '../nodes/Node'

@InterfaceType()
export default class Edge {
  @Field()
  cursor!: string
}

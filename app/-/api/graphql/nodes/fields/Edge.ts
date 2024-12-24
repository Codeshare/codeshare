import { Field, InterfaceType } from "type-graphql"

@InterfaceType()
export default class Edge {
  @Field()
  cursor!: string
}

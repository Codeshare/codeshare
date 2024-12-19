import Node from "@/app/-/api/graphql/nodes/nodes/Node"
import { Field, InterfaceType } from "type-graphql"

@InterfaceType()
export default class Edge {
  @Field()
  cursor!: string
}

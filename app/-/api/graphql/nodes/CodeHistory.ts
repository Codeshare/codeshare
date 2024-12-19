import "reflect-metadata"

import { IsDate, IsDefined, IsOptional, MaxLength } from "class-validator"
import GraphQLFirepadTextOperation from "graphql-firepad-text-operation"
import { Field, ObjectType } from "type-graphql"

import Connection from "./fields/Connection"
import CreatedBy from "./fields/CreatedBy"
import Edge from "./fields/Edge"
import Node from "./Node"

export type TextOperationType = Array<string | number>

@ObjectType({ implements: Node })
export default class CodeHistory extends Node {
  @Field()
  @IsDefined()
  @MaxLength(256)
  codeshareId!: string
  @Field()
  @IsDefined()
  @IsDate()
  createdAt!: Date
  @Field()
  @IsDefined()
  createdBy!: CreatedBy
  @Field()
  @IsDefined()
  @MaxLength(256)
  historyId!: string
  @Field(() => GraphQLFirepadTextOperation)
  @IsDefined()
  value!: TextOperationType
}

@ObjectType({ implements: Edge })
export class CodeHistoryEdge extends Edge {
  @Field(() => CodeHistory)
  @IsDefined()
  node!: CodeHistory
  @Field()
  @IsDefined()
  @MaxLength(256)
  cursor!: string
}

@ObjectType({ implements: Edge })
class CodeHistoryConnectionEdge extends Edge {
  @Field(() => CodeHistory, { nullable: true })
  @IsOptional()
  node!: CodeHistory | null
  @Field()
  @IsDefined()
  @MaxLength(256)
  cursor!: string
}

@ObjectType({ implements: Connection })
export class CodeHistoryConnection extends Connection {
  @Field(() => [CodeHistoryConnectionEdge!])
  @IsDefined()
  edges!: CodeHistoryConnectionEdge[]
}

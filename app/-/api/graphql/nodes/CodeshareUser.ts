import {
  IsDate,
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  MaxLength,
} from "class-validator"

import "reflect-metadata"

import {
  createUnionType,
  Field,
  Int,
  InterfaceType,
  ObjectType,
} from "type-graphql"

import Connection from "./fields/Connection"
import CreatedBy from "./fields/CreatedBy"
import Edge from "./fields/Edge"
import ModifiedBy from "./fields/ModifiedBy"
import Node from "./Node"

// TODO: nullable props?
@ObjectType()
export class CursorType {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  position?: number
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  selectionEnd?: number
}

@ObjectType({ implements: Node })
export default class CodeshareUser extends Node {
  @Field()
  @IsDefined()
  @MaxLength(256)
  codeshareId!: string
  @Field()
  @IsDefined()
  @MaxLength(15)
  color!: string
  @Field()
  @IsDefined()
  @IsDate()
  createdAt!: Date
  @Field()
  @IsDefined()
  createdBy!: CreatedBy
  @Field(() => CursorType, { nullable: true })
  @IsOptional()
  cursor!: CursorType | null
  @Field()
  @IsDefined()
  modifiedAt!: Date
  @Field()
  @IsDefined()
  modifiedBy!: ModifiedBy
}

@ObjectType({ implements: Edge })
export class CodeshareUserEdge extends Edge {
  @Field(() => CodeshareUser)
  @IsDefined()
  node!: CodeshareUser
  @Field()
  @IsDefined()
  @MaxLength(256)
  cursor!: string
}

@ObjectType({ implements: Edge })
class CodeshareUserConnectionEdge extends Edge {
  @Field(() => CodeshareUser, { nullable: true })
  @IsOptional()
  node!: CodeshareUser | null
  @Field()
  @IsDefined()
  @MaxLength(256)
  cursor!: string
}

@ObjectType({ implements: Connection })
export class CodeshareUsersConnection extends Connection {
  @Field(() => [CodeshareUserConnectionEdge!])
  @IsDefined()
  edges!: CodeshareUserConnectionEdge[]
}

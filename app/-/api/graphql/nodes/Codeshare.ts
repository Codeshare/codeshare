import "reflect-metadata"

import {
  IsBoolean,
  IsDate,
  IsDefined,
  IsOptional,
  MaxLength,
} from "class-validator"
import GraphQLFirepadTextOperation from "graphql-firepad-text-operation"
import { Field, ID, InputType, ObjectType } from "type-graphql"

import {
  CodeHistoryConnection,
  CodeHistoryEdge,
  type TextOperationType,
} from "./CodeHistory"
import CreatedBy from "./fields/CreatedBy"
import ModifiedBy from "./fields/ModifiedBy"
import Node from "./Node"

@ObjectType()
export class CanEdit {
  @Field()
  @IsDefined()
  @IsBoolean()
  me!: boolean
  @Field(() => [ID!], { nullable: true })
  @IsOptional()
  userIds?: string[]
}

@InputType()
export class CodeCheckpointInput {
  @Field()
  @IsDefined()
  @MaxLength(256)
  codeHistoryId!: string
  @Field(() => GraphQLFirepadTextOperation!)
  @IsDefined()
  value!: TextOperationType
}

@ObjectType()
export class CodeCheckpoint extends CodeCheckpointInput {
  @Field()
  @IsDefined()
  @MaxLength(256)
  codeHistoryId!: string
  @Field(() => CodeHistoryEdge!)
  @IsDefined()
  codeHistoryEdge!: CodeHistoryEdge
  @Field(() => CreatedBy!)
  @IsDefined()
  createdBy!: CreatedBy
  @Field()
  @IsDefined()
  @MaxLength(256)
  historyId!: string
  @Field(() => GraphQLFirepadTextOperation!)
  @IsDefined()
  value!: TextOperationType
}

// Codeshare Node

@ObjectType({ description: "The user model", implements: Node })
export default class Codeshare extends Node {
  @Field()
  @IsDefined()
  @IsDate()
  accessedAt!: Date
  @Field()
  @IsDefined()
  canEdit!: CanEdit
  @Field({ nullable: true })
  @IsOptional()
  codeCheckpoint?: CodeCheckpoint
  @Field(() => CodeHistoryConnection!)
  @IsDefined()
  codeHistory!: CodeHistoryConnection
  @Field()
  @IsDefined()
  @IsDate()
  createdAt!: Date
  @Field()
  @IsDefined()
  createdBy!: CreatedBy
  @Field()
  @IsDefined()
  @IsDate()
  modifiedAt!: Date
  @Field()
  @IsDefined()
  modifiedBy!: ModifiedBy

  // settings
  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(50)
  modeName?: string
  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(2)
  tabSize?: string
  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(512)
  title?: string
}

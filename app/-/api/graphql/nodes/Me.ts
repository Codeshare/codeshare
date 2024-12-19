import "reflect-metadata"

import { IsDefined, IsOptional, MaxLength } from "class-validator"
import { Field, ObjectType } from "type-graphql"

import Codeshare from "./Codeshare"
import Connection from "./fields/Connection"
import Edge from "./fields/Edge"
import UserDefaultCodeshareSettings from "./fields/UserDefaultCodeshareSettings"
import Node from "./Node"
import User from "./User"

@ObjectType({ implements: Edge })
export class CodeshareEdge extends Edge {
  @Field(() => Codeshare)
  @IsDefined()
  node!: Codeshare
  @Field()
  @IsDefined()
  @MaxLength(256)
  cursor!: string
}

@ObjectType({ implements: Edge })
class CodeshareConnectionEdge extends Edge {
  @Field(() => Codeshare, { nullable: true })
  @IsOptional()
  node!: Codeshare | null
  @Field()
  @IsDefined()
  @MaxLength(256)
  cursor!: string
}

@ObjectType({ implements: Connection })
export class CodeshareConnection extends Connection {
  @Field(() => [CodeshareConnectionEdge!])
  @IsDefined()
  edges!: CodeshareConnectionEdge[]
}

@ObjectType({ implements: Node })
export default class Me extends User {
  @Field(() => CodeshareConnection)
  @IsDefined()
  codesharesCreated!: CodeshareConnection
  @Field({ nullable: true })
  @IsOptional()
  defaultCodeshareSettings?: UserDefaultCodeshareSettings
  @Field({ nullable: true })
  @IsOptional()
  companyImage?: string
}

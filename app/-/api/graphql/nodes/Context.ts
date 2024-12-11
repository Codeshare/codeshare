import { IsBoolean, IsDefined, IsOptional, IsString } from 'class-validator'
import { Field, ObjectType } from 'type-graphql'
import Node from './Node'
import Me from './Me'

@ObjectType({ description: 'The user model', implements: Node })
export default class Context extends Node {
  @Field()
  @IsDefined()
  @IsBoolean()
  isSocket!: boolean
  @Field()
  @IsOptional()
  @IsString()
  xForwardedFor?: string
  @Field()
  @IsDefined()
  @IsString()
  clientId!: string
  @Field(() => Me)
  @IsOptional()
  me?: Me
  @Field()
  @IsDefined()
  @IsString()
  token!: string
}

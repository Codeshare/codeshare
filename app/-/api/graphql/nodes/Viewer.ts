import { IsDefined } from 'class-validator'
import 'reflect-metadata'

import { Field, ObjectType } from 'type-graphql'

import Me from './Me'

@ObjectType()
export default class Viewer {
  @Field(() => Me)
  @IsDefined()
  me!: Me
}

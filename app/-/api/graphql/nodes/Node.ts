import { IsDefined, IsOptional, MaxLength } from 'class-validator'
import { Field, ID, InterfaceType } from 'type-graphql'
import logger from '@codeshare/log'

@InterfaceType({
  resolveType: (value) => {
    logger.trace('VALUE', value)
    if (value?.typeName === 'User')
      return require('~/graphql/nodes/User').default
    if (value?.typeName === 'Me') return require('~/graphql/nodes/Me').default
    if (value?.typeName === 'Codeshare')
      return require('~/graphql/nodes/Codeshare').default
  },
})
export default class xNode {
  @Field(() => ID)
  @IsDefined()
  @MaxLength(256)
  id!: string
  @Field({ nullable: true })
  @IsOptional()
  @MaxLength(100)
  typeName?: string
}

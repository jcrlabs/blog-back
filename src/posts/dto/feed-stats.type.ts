import { ObjectType, Field, Int } from '@nestjs/graphql'

@ObjectType()
export class CountType {
  @Field()
  key: string

  @Field(() => Int)
  count: number

  @Field({ nullable: true })
  tier?: string
}

@ObjectType()
export class FeedStatsType {
  @Field(() => Int)
  total: number

  @Field({ nullable: true })
  updatedAt?: Date

  @Field(() => [CountType])
  tiers: CountType[]

  @Field(() => [CountType])
  tags: CountType[]

  @Field(() => [CountType])
  sources: CountType[]
}

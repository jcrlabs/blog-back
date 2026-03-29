import { ObjectType, Field, ID } from '@nestjs/graphql'
@ObjectType()
export class CategoryType {
  @Field(() => ID) id: string
  @Field() name: string
  @Field() slug: string
  @Field({ nullable: true }) description?: string
}

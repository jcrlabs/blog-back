import { InputType, Field, Int } from '@nestjs/graphql'
import { IsOptional, IsInt, Min, Max } from 'class-validator'

@InputType()
export class PaginationInput {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  first?: number = 20

  @Field({ nullable: true })
  @IsOptional()
  after?: string
}

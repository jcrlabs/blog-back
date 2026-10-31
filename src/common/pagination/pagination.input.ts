import { InputType, Field, Int } from '@nestjs/graphql'
import { IsOptional, IsInt, IsString, Min, Max, MaxLength } from 'class-validator'

@InputType()
export class PaginationInput {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number = 20

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  after?: string
}

import { InputType, Field, ID } from '@nestjs/graphql'
import { IsString, IsOptional, IsMongoId, MinLength } from 'class-validator'

@InputType()
export class CreatePostInput {
  @Field()
  @IsString()
  @MinLength(3)
  title: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  summary?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  coverImage?: string

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  category?: string

  @Field(() => [ID], { nullable: true, defaultValue: [] })
  @IsOptional()
  @IsMongoId({ each: true })
  tags?: string[]
}

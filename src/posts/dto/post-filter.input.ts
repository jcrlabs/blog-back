import { InputType, Field } from '@nestjs/graphql'
import { IsOptional, IsString } from 'class-validator'
import { PostStatus } from '../schemas/post.schema'

@InputType()
export class PostFilterInput {
  @Field(() => PostStatus, { nullable: true })
  @IsOptional()
  status?: PostStatus

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  category?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  tag?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  source?: string
}

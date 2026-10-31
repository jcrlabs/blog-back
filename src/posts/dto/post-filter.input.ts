import { InputType, Field } from '@nestjs/graphql'
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator'
import { PostStatus } from '../schemas/post.schema'
import { SourceTier } from '../../ingest/sources'

@InputType()
export class PostFilterInput {
  @Field(() => PostStatus, { nullable: true })
  @IsOptional()
  status?: PostStatus

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  category?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tag?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  source?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsISO8601()
  since?: string

  @Field(() => SourceTier, { nullable: true })
  @IsOptional()
  @IsEnum(SourceTier)
  tier?: SourceTier
}

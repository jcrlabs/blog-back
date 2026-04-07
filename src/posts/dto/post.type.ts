import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql'
import { PostStatus } from '../schemas/post.schema'

registerEnumType(PostStatus, { name: 'PostStatus' })

@ObjectType()
export class PostType {
  @Field(() => ID)
  id: string

  @Field()
  title: string

  @Field()
  slug: string

  @Field({ nullable: true })
  summary?: string

  @Field({ nullable: true })
  coverImage?: string

  @Field(() => PostStatus)
  status: PostStatus

  @Field({ nullable: true })
  publishedAt?: Date

  @Field({ nullable: true })
  content?: string

  @Field({ nullable: true })
  sourceUrl?: string

  @Field({ nullable: true })
  source?: string

  @Field(() => [String], { defaultValue: [] })
  tagNames: string[]

  @Field()
  createdAt: Date

  @Field()
  updatedAt: Date
}

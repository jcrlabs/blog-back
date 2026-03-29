import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type PostDocument = Post & Document

export enum PostStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  PUBLISHED = 'PUBLISHED',
  INGESTED_AUTO = 'INGESTED_AUTO',
  INGESTED_MANUAL = 'INGESTED_MANUAL',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true })
  title: string

  @Prop({ required: true, unique: true })
  slug: string

  @Prop({ type: Object })
  content: Record<string, unknown>

  @Prop()
  summary: string

  @Prop()
  coverImage: string

  @Prop({ type: String, enum: PostStatus, default: PostStatus.DRAFT })
  status: PostStatus

  @Prop()
  publishedAt: Date

  @Prop({ type: Types.ObjectId, ref: 'User' })
  author: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  category: Types.ObjectId

  @Prop([{ type: Types.ObjectId, ref: 'Tag' }])
  tags: Types.ObjectId[]

  @Prop()
  sourceUrl: string

  @Prop()
  source: string
}

export const PostSchema = SchemaFactory.createForClass(Post)
PostSchema.index({ slug: 1 })
PostSchema.index({ title: 'text', summary: 'text' })
PostSchema.index({ status: 1, publishedAt: -1 })

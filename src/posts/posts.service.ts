import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, type FilterQuery } from 'mongoose'
import slugify from 'slugify'
import { Post, PostStatus, type PostDocument } from './schemas/post.schema'
import type { CreatePostInput } from './dto/create-post.input'
import type { PostFilterInput } from './dto/post-filter.input'
import type { PaginationInput } from '../common/pagination/pagination.input'

@Injectable()
export class PostsService {
  constructor(@InjectModel(Post.name) private model: Model<PostDocument>) {}

  async create(input: CreatePostInput, authorId: string): Promise<PostDocument> {
    const slug = await this.uniqueSlug(input.title)
    return this.model.create({ ...input, slug, author: authorId })
  }

  async findPublished(filter?: PostFilterInput, pagination?: PaginationInput) {
    const query: FilterQuery<Post> = {
      status: { $in: [PostStatus.PUBLISHED, PostStatus.INGESTED_AUTO] },
    }
    if (filter?.search) {
      query.$text = { $search: filter.search }
    }
    if (filter?.source) {
      query.source = filter.source
    }
    if (filter?.since) {
      query.publishedAt = { $gte: new Date(filter.since) }
    }

    const limit = pagination?.first ?? 20
    let q = this.model.find(query).sort({ publishedAt: -1 }).limit(limit)

    if (pagination?.after) {
      const cursor = Buffer.from(pagination.after, 'base64').toString()
      q = q.where('_id').lt(cursor as unknown as number)
    }

    return q.lean().exec()
  }

  findBySlug(slug: string) {
    return this.model
      .findOne({ slug, status: { $in: [PostStatus.PUBLISHED, PostStatus.INGESTED_AUTO] } })
      .lean()
      .exec()
  }

  async publish(id: string): Promise<PostDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { status: PostStatus.PUBLISHED, publishedAt: new Date() }, { new: true })
      .exec()
  }

  async unpublish(id: string): Promise<PostDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { status: PostStatus.DRAFT, $unset: { publishedAt: 1 } }, { new: true })
      .exec()
  }

  async findPending() {
    return this.model.find({ status: PostStatus.INGESTED_MANUAL }).sort({ createdAt: -1 }).lean().exec()
  }

  async approve(id: string): Promise<PostDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { status: PostStatus.PUBLISHED, publishedAt: new Date() }, { new: true })
      .exec()
  }

  async reject(id: string): Promise<PostDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { status: PostStatus.REJECTED }, { new: true })
      .exec()
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec()
    return result !== null
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true })
    let slug = base
    let i = 1
    while (await this.model.exists({ slug })) {
      slug = `${base}-${i++}`
    }
    return slug
  }
}

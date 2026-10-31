import { Injectable, BadRequestException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types, type FilterQuery } from 'mongoose'
import slugify from 'slugify'
import { Post, PostStatus, type PostDocument } from './schemas/post.schema'
import type { CreatePostInput } from './dto/create-post.input'
import type { PostFilterInput } from './dto/post-filter.input'
import type { PaginationInput } from '../common/pagination/pagination.input'

const PUBLIC_FILTER: FilterQuery<Post> = {
  status: { $in: [PostStatus.PUBLISHED, PostStatus.INGESTED_AUTO] },
}

@Injectable()
export class PostsService {
  constructor(@InjectModel(Post.name) private model: Model<PostDocument>) {}

  async create(input: CreatePostInput, authorId: string): Promise<PostDocument> {
    const slug = await this.uniqueSlug(input.title)
    return this.model.create({ ...input, slug, author: authorId })
  }

  async findPublished(filter?: PostFilterInput, pagination?: PaginationInput) {
    const query: FilterQuery<Post> = { ...PUBLIC_FILTER }
    if (filter?.search) query.$text = { $search: filter.search }
    if (filter?.source) query.source = filter.source
    if (filter?.tier) query.sourceTier = filter.tier
    if (filter?.tag) query.tagNames = filter.tag
    if (filter?.since) query.publishedAt = { $gte: new Date(filter.since) }

    // Cursor = base64("<publishedAt ISO>|<ObjectId>") so it matches the sort order
    if (pagination?.after) {
      const [rawDate, rawId] = Buffer.from(pagination.after, 'base64').toString().split('|')
      const date = new Date(rawDate)
      if (!rawId || !Types.ObjectId.isValid(rawId) || Number.isNaN(date.getTime())) {
        throw new BadRequestException('Invalid pagination cursor')
      }
      const id = new Types.ObjectId(rawId)
      query.$and = [{ $or: [{ publishedAt: { $lt: date } }, { publishedAt: date, _id: { $lt: id } }] }]
    }

    const limit = pagination?.first ?? 20
    return this.model.find(query).sort({ publishedAt: -1, _id: -1 }).limit(limit).lean().exec()
  }

  async feedStats() {
    const [result] = await this.model.aggregate<{
      total: { n: number }[]
      updatedAt: { d: Date }[]
      tiers: { _id: string; count: number }[]
      tags: { _id: string; count: number }[]
      sources: { _id: string; count: number }[]
    }>([
      { $match: PUBLIC_FILTER },
      {
        $facet: {
          total: [{ $count: 'n' }],
          updatedAt: [{ $group: { _id: null, d: { $max: '$createdAt' } } }],
          tiers: [{ $match: { sourceTier: { $ne: null } } }, { $group: { _id: '$sourceTier', count: { $sum: 1 } } }],
          tags: [{ $unwind: '$tagNames' }, { $group: { _id: '$tagNames', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
          sources: [{ $match: { source: { $ne: null } } }, { $group: { _id: '$source', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        },
      },
    ])
    const toCounts = (rows: { _id: string; count: number }[]) => rows.map((r) => ({ key: r._id, count: r.count }))
    return {
      total: result?.total[0]?.n ?? 0,
      updatedAt: result?.updatedAt[0]?.d ?? null,
      tiers: toCounts(result?.tiers ?? []),
      tags: toCounts(result?.tags ?? []),
      sources: toCounts(result?.sources ?? []),
    }
  }

  findBySlug(slug: string) {
    return this.model
      .findOne({ slug, ...PUBLIC_FILTER })
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

  async approveAll(): Promise<number> {
    const result = await this.model.updateMany(
      { status: PostStatus.INGESTED_MANUAL },
      { status: PostStatus.PUBLISHED, publishedAt: new Date() },
    )
    return result.modifiedCount
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

  async toggleFavorite(id: string): Promise<PostDocument | null> {
    const post = await this.model.findById(id).exec()
    if (!post) return null
    post.favorited = !post.favorited
    return post.save()
  }

  // Removes non-favorited ingested posts older than cutoff, plus legacy posts ingested
  // before tiers existed (those carried synthetic publish dates).
  async pruneIngested(cutoff: Date): Promise<number> {
    const result = await this.model
      .deleteMany({
        status: PostStatus.INGESTED_AUTO,
        favorited: { $ne: true },
        $or: [{ publishedAt: { $lt: cutoff } }, { sourceTier: { $exists: false } }],
      })
      .exec()
    return result.deletedCount
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

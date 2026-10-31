import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import Parser from 'rss-parser'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Post, PostStatus, type PostDocument } from '../posts/schemas/post.schema'
import { PostsService } from '../posts/posts.service'
import { SOURCES, type FeedSource } from './sources'
import { extractTags, isNonEnglish, normalizeUrl } from './feed-utils'

// Posts older than this are pruned (favorited ones are kept forever) and never ingested.
export const RETENTION_DAYS = 14
const CONCURRENCY = 6

type FeedItem = Parser.Item & { content?: string }

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name)
  private parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'jcrlabs-ai-feed/1.0 (+https://tech-blog.jcrlabs.net)' } })
  private running = false

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private postsService: PostsService,
  ) {}

  @Cron('0 * * * *')
  async ingestFeeds() {
    if (this.running) {
      this.logger.warn('Ingestion already running, skipping')
      return
    }
    this.running = true
    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
      const pruned = await this.postsService.pruneIngested(cutoff)
      this.logger.log(`Pruned ${pruned} posts older than ${RETENTION_DAYS}d`)

      let inserted = 0
      for (let i = 0; i < SOURCES.length; i += CONCURRENCY) {
        const batch = SOURCES.slice(i, i + CONCURRENCY)
        const results = await Promise.allSettled(batch.map((s) => this.ingestSource(s, cutoff)))
        results.forEach((r, j) => {
          if (r.status === 'fulfilled') inserted += r.value
          else this.logger.warn(`Failed to ingest ${batch[j].name} (${batch[j].url}): ${r.reason}`)
        })
      }
      this.logger.log(`RSS ingestion complete: ${inserted} new posts`)
    } finally {
      this.running = false
    }
  }

  private async ingestSource(source: FeedSource, cutoff: Date): Promise<number> {
    let budget = source.maxItems
    if (source.maxPerDay) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const today = await this.postModel.countDocuments({ source: source.name, createdAt: { $gte: since } })
      budget = Math.min(budget, source.maxPerDay - today)
      if (budget <= 0) return 0
    }
    const feed = await this.parser.parseURL(source.url)
    const items = (feed.items as FeedItem[])
      .filter((item) => item.link && item.title && !isNonEnglish(item.title))
      .map((item) => ({ item, date: this.itemDate(item) }))
      .filter(({ date }) => date >= cutoff)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, budget)

    let inserted = 0
    for (const { item, date } of items) {
      const title = item.title!.trim()
      const sourceUrl = normalizeUrl(item.link!)
      const exists = await this.postModel.exists({ $or: [{ sourceUrl }, { title }] })
      if (exists) continue
      const summary = this.cleanText(item.contentSnippet ?? item.summary ?? '').slice(0, 500)
      try {
        await this.postModel.create({
          title,
          slug: await this.uniqueSlug(title),
          summary: summary || undefined,
          content: item.content || undefined,
          sourceUrl,
          source: source.name,
          sourceTier: source.tier,
          status: PostStatus.INGESTED_AUTO,
          publishedAt: date,
          tagNames: extractTags(`${title} ${summary}`),
        })
        inserted++
      } catch (err) {
        this.logger.warn(`Failed to insert "${title}" from ${source.name}: ${err}`)
      }
    }
    return inserted
  }

  // Real publication date from the feed; items without a parseable date count as "now".
  private itemDate(item: FeedItem): Date {
    const raw = item.isoDate ?? item.pubDate
    const d = raw ? new Date(raw) : new Date()
    if (Number.isNaN(d.getTime()) || d.getTime() > Date.now()) return new Date()
    return d
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'post'
    let slug = base
    let i = 1
    while (await this.postModel.exists({ slug })) {
      slug = `${base}-${i++}`
    }
    return slug
  }
}

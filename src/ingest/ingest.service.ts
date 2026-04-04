import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import Parser from 'rss-parser'
import { PostStatus } from '../posts/schemas/post.schema'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Post, type PostDocument } from '../posts/schemas/post.schema'

const AUTO_APPROVE = [
  { name: 'Kubernetes Blog', url: 'https://kubernetes.io/feed.xml' },
  { name: 'CNCF Blog', url: 'https://www.cncf.io/feed/' },
  { name: 'CNCF Case Studies', url: 'https://www.cncf.io/case-studies/feed/' },
  { name: 'dev.to kubernetes', url: 'https://dev.to/feed/tag/kubernetes' },
  { name: 'dev.to devops', url: 'https://dev.to/feed/tag/devops' },
  { name: 'dev.to docker', url: 'https://dev.to/feed/tag/docker' },
  { name: 'dev.to cloud', url: 'https://dev.to/feed/tag/cloud' },
  { name: 'dev.to go', url: 'https://dev.to/feed/tag/go' },
  { name: 'dev.to rust', url: 'https://dev.to/feed/tag/rust' },
  { name: 'dev.to typescript', url: 'https://dev.to/feed/tag/typescript' },
  { name: 'dev.to webassembly', url: 'https://dev.to/feed/tag/webassembly' },
  { name: 'dev.to mlops', url: 'https://dev.to/feed/tag/mlops' },
  { name: 'Prometheus Blog', url: 'https://prometheus.io/blog/feed.xml' },
  { name: 'Grafana Blog', url: 'https://grafana.com/blog/index.xml' },
  { name: 'ArgoCD Blog', url: 'https://blog.argoproj.io/feed' },
  { name: 'Cilium Blog', url: 'https://cilium.io/blog/rss.xml' },
  { name: 'Flux Blog', url: 'https://fluxcd.io/blog/index.xml' },
]

const MANUAL_APPROVE = [
  { name: 'Learnk8s', url: 'https://learnk8s.io/rss.xml' },
  { name: 'The New Stack', url: 'https://thenewstack.io/feed/' },
  { name: 'HashiCorp Blog', url: 'https://www.hashicorp.com/blog/feed.xml' },
  { name: 'Weaveworks Blog', url: 'https://www.weave.works/blog/feed' },
  { name: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/rss/' },
  { name: 'Tailscale Blog', url: 'https://tailscale.com/blog/index.xml' },
  { name: 'Fly.io Blog', url: 'https://fly.io/blog/feed.xml' },
  { name: 'PlanetScale Blog', url: 'https://planetscale.com/blog/feed.xml' },
  { name: 'Hacker News K8s', url: 'https://hnrss.org/newest?q=kubernetes' },
  { name: 'Hacker News Go', url: 'https://hnrss.org/newest?q=golang' },
]

const TAG_MAP: Record<string, string[]> = {
  kubernetes: ['kubernetes', 'k8s'], helm: ['helm'], argocd: ['argocd', 'gitops'],
  docker: ['docker', 'container'], go: ['go', 'golang'], rust: ['rust'],
  prometheus: ['prometheus', 'monitoring'], grafana: ['grafana'], terraform: ['terraform'],
  'github-actions': ['ci/cd', 'github actions'], react: ['react'], nestjs: ['nestjs'],
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name)
  private parser = new Parser({ timeout: 10000 })

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
  ) {}

  @Cron('0 */6 * * *')
  async ingestFeeds() {
    this.logger.log('Starting RSS ingestion')
    const all = [...AUTO_APPROVE.map((s) => ({ ...s, auto: true })), ...MANUAL_APPROVE.map((s) => ({ ...s, auto: false }))]
    for (const source of all) {
      try {
        const feed = await this.parser.parseURL(source.url)
        for (const item of feed.items.slice(0, 20)) {
          if (!item.link || !item.title) continue
          const exists = await this.postModel.findOne({ sourceUrl: item.link }).lean()
          if (exists) continue
          const tags = this.extractTags(item.title + ' ' + (item.contentSnippet ?? ''))
          await this.postModel.create({
            title: item.title,
            slug: await this.uniqueSlug(item.title),
            summary: item.contentSnippet?.slice(0, 500),
            sourceUrl: item.link,
            source: source.name,
            status: source.auto ? PostStatus.INGESTED_AUTO : PostStatus.INGESTED_MANUAL,
            publishedAt: source.auto ? new Date() : undefined,
            tagNames: tags,
          })
        }
      } catch (err) {
        this.logger.warn(`Failed to ingest ${source.name}: ${err}`)
      }
    }
    this.logger.log('RSS ingestion complete')
  }

  private extractTags(text: string): string[] {
    const lower = text.toLowerCase()
    const found = new Set<string>()
    for (const [tag, keywords] of Object.entries(TAG_MAP)) {
      if (keywords.some((k) => lower.includes(k))) found.add(tag)
    }
    return [...found]
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
    let slug = base
    let i = 1
    while (await this.postModel.exists({ slug })) {
      slug = `${base}-${i++}`
    }
    return slug
  }
}

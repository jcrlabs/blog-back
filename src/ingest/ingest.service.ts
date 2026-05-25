import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import Parser from 'rss-parser'
import { PostStatus } from '../posts/schemas/post.schema'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Post, type PostDocument } from '../posts/schemas/post.schema'
import { PostsService } from '../posts/posts.service'

// "top" = always ingest last N posts regardless of date (premium/lab sources, low frequency)
// "recent" = only ingest posts from the last 6h (high-volume community feeds)
const AUTO_APPROVE: { name: string; url: string; mode: 'top' | 'recent' }[] = [
  // Labs / Research — top 25
  { name: 'Anthropic Blog',         url: 'https://anthropic.substack.com/feed',                          mode: 'top' },
  { name: 'OpenAI Blog',            url: 'https://openai.com/blog/rss.xml',                              mode: 'top' },
  { name: 'Google DeepMind',        url: 'https://deepmind.google/blog/rss.xml',                         mode: 'top' },
  { name: 'Google AI Research',     url: 'https://blog.research.google/feeds/posts/default',             mode: 'top' },
  { name: 'Hugging Face Blog',      url: 'https://huggingface.co/blog/feed.xml',                         mode: 'top' },
  { name: 'Mistral AI',             url: 'https://mistral.substack.com/feed',                            mode: 'top' },
  { name: 'NVIDIA AI Blog',         url: 'https://blogs.nvidia.com/blog/category/generative-ai/feed/',   mode: 'top' },
  { name: 'AWS ML Blog',            url: 'https://aws.amazon.com/blogs/machine-learning/feed/',           mode: 'top' },
  // Expert bloggers — top 25
  { name: 'Simon Willison',         url: 'https://simonwillison.net/atom/everything/',                   mode: 'top' },
  { name: 'Chip Huyen',             url: 'https://huyenchip.com/feed.xml',                               mode: 'top' },
  { name: 'Sebastian Raschka',      url: 'https://magazine.sebastianraschka.com/feed',                   mode: 'top' },
  { name: 'Lilian Weng',            url: 'https://lilianweng.github.io/index.xml',                       mode: 'top' },
  { name: 'Jay Alammar',            url: 'https://jalammar.github.io/feed.xml',                          mode: 'top' },
  { name: 'The Sequence',           url: 'https://thesequence.substack.com/feed',                        mode: 'top' },
  // Frameworks — top 25
  { name: 'LangChain Blog',         url: 'https://blog.langchain.dev/rss.xml',                           mode: 'top' },
  // dev.to AI tags — last 6h only
  { name: 'dev.to ai',              url: 'https://dev.to/feed/tag/ai',                                   mode: 'recent' },
  { name: 'dev.to llm',             url: 'https://dev.to/feed/tag/llm',                                  mode: 'recent' },
  { name: 'dev.to machinelearning', url: 'https://dev.to/feed/tag/machinelearning',                      mode: 'recent' },
  { name: 'dev.to openai',          url: 'https://dev.to/feed/tag/openai',                               mode: 'recent' },
  { name: 'dev.to claudeai',        url: 'https://dev.to/feed/tag/claudeai',                             mode: 'recent' },
  { name: 'dev.to rag',             url: 'https://dev.to/feed/tag/rag',                                  mode: 'recent' },
  { name: 'dev.to agents',          url: 'https://dev.to/feed/tag/agents',                               mode: 'recent' },
  // Medium AI tags — last 6h only
  { name: 'Medium AI',              url: 'https://medium.com/feed/tag/artificial-intelligence',          mode: 'recent' },
  { name: 'Medium LLM',             url: 'https://medium.com/feed/tag/llm',                              mode: 'recent' },
  { name: 'Medium MLOps',           url: 'https://medium.com/feed/tag/mlops',                            mode: 'recent' },
  { name: 'Medium GenAI',           url: 'https://medium.com/feed/tag/generative-ai',                    mode: 'recent' },
]

const TOP_N = 25

const TAG_MAP: Record<string, string[]> = {
  llm:            ['llm', 'large language model', 'language model'],
  rag:            ['rag', 'retrieval augmented', 'retrieval-augmented'],
  mcp:            ['mcp', 'model context protocol'],
  agents:         ['agent', 'agentic', 'multi-agent', 'autonomous agent'],
  'fine-tuning':  ['fine-tun', 'finetuning', 'finetune', 'lora', 'qlora'],
  prompting:      ['prompt engineering', 'few-shot', 'chain-of-thought', 'cot', 'system prompt'],
  openai:         ['openai', 'gpt-4', 'gpt4', 'chatgpt', ' o1 ', ' o3 '],
  anthropic:      ['anthropic', 'claude', 'claude-3', 'claude 3'],
  gemini:         ['gemini', 'deepmind', 'google ai', 'bard'],
  mistral:        ['mistral', 'mixtral'],
  'open-source':  ['llama', 'ollama', 'hugging face', 'huggingface', 'phi-', 'qwen', 'falcon', 'open-source model'],
  mlops:          ['mlops', 'ml ops', 'model deployment', 'model serving', 'inference server'],
  'vector-db':    ['vector database', 'vector db', 'pinecone', 'weaviate', 'chroma', 'qdrant', 'faiss', 'embedding store'],
  architecture:   ['ai architecture', 'system design', 'ai system', 'ai engineer', 'ai infrastructure'],
  'ai-safety':    ['alignment', 'ai safety', 'responsible ai', 'guardrail', 'red team'],
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name)
  private parser = new Parser({ timeout: 10000 })

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private postsService: PostsService,
  ) {}

  @Cron('0 */6 * * *')
  async ingestFeeds() {
    this.logger.log('Clearing non-favorited posts before ingestion')
    const deleted = await this.postsService.deleteAllNonFavorited()
    this.logger.log(`Deleted ${deleted} non-favorited posts`)
    this.logger.log('Starting RSS ingestion')
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000)
    for (const source of AUTO_APPROVE) {
      try {
        const feed = await this.parser.parseURL(source.url)
        const items = source.mode === 'top'
          ? feed.items.slice(0, TOP_N)
          : feed.items.filter(item => !item.isoDate || new Date(item.isoDate) >= cutoff)
        for (const item of items) {
          if (!item.link || !item.title) continue
          if (this.isNonEnglish(item.title)) continue
          const normalizedUrl = this.normalizeUrl(item.link)
          const exists = await this.postModel.findOne({ sourceUrl: normalizedUrl }).lean()
          if (exists) continue
          const tags = this.extractTags(item.title + ' ' + (item.contentSnippet ?? ''))
          const content = (item as unknown as { content?: string }).content ?? null
          try {
            await this.postModel.create({
              title: item.title,
              slug: await this.uniqueSlug(item.title),
              summary: item.contentSnippet?.slice(0, 500),
              content: content || undefined,
              sourceUrl: normalizedUrl,
              source: source.name,
              status: PostStatus.INGESTED_AUTO,
              // premium: random timestamp within last 6h so they mix naturally with community posts
              publishedAt: source.mode === 'top'
                ? new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000)
                : (item.isoDate ? new Date(item.isoDate) : new Date()),
              tagNames: tags,
            })
          } catch (itemErr) {
            this.logger.warn(`Failed to insert item "${item.title}" from ${source.name}: ${itemErr}`)
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to ingest ${source.name}: ${err}`)
      }
    }
    this.logger.log('RSS ingestion complete')
  }

  private isNonEnglish(title: string): boolean {
    // Reject non-Latin scripts (CJK, Arabic, Cyrillic, Hebrew, Thai, etc.)
    const nonLatin = (title.match(/[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/g) ?? []).length
    if (nonLatin / title.length > 0.05) return true
    // Reject Latin-script non-English: accented characters typical of Spanish, Portuguese, French, German, etc.
    const accented = (title.match(/[áàâãäåéèêëíìîïóòôõöúùûüýÿñçæœÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝŸÑÇÆŒ]/g) ?? []).length
    return accented / title.length > 0.06
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url)
      u.search = ''
      u.hash = ''
      return u.toString()
    } catch {
      return url
    }
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

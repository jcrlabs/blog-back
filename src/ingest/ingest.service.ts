import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import Parser from 'rss-parser'
import { PostStatus } from '../posts/schemas/post.schema'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Post, type PostDocument } from '../posts/schemas/post.schema'
import { PostsService } from '../posts/posts.service'

const AUTO_APPROVE = [
  // Labs / Research (verified working)
  { name: 'Anthropic Blog',      url: 'https://anthropic.substack.com/feed' },
  { name: 'OpenAI Blog',         url: 'https://openai.com/blog/rss.xml' },
  { name: 'Google DeepMind',     url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'Google AI Research',  url: 'https://blog.research.google/feeds/posts/default' },
  { name: 'Hugging Face Blog',   url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'Mistral AI',          url: 'https://mistral.substack.com/feed' },
  { name: 'NVIDIA AI Blog',      url: 'https://blogs.nvidia.com/blog/category/generative-ai/feed/' },
  { name: 'AWS ML Blog',         url: 'https://aws.amazon.com/blogs/machine-learning/feed/' },
  // Expert bloggers (verified working)
  { name: 'Simon Willison',      url: 'https://simonwillison.net/atom/everything/' },
  { name: 'Chip Huyen',          url: 'https://huyenchip.com/feed.xml' },
  { name: 'Sebastian Raschka',   url: 'https://magazine.sebastianraschka.com/feed' },
  { name: 'Lilian Weng',         url: 'https://lilianweng.github.io/index.xml' },
  { name: 'Jay Alammar',         url: 'https://jalammar.github.io/feed.xml' },
  { name: 'The Sequence',        url: 'https://thesequence.substack.com/feed' },
  // Frameworks (verified working)
  { name: 'LangChain Blog',      url: 'https://blog.langchain.dev/rss.xml' },
  // dev.to AI tags (verified working)
  { name: 'dev.to ai',           url: 'https://dev.to/feed/tag/ai' },
  { name: 'dev.to llm',          url: 'https://dev.to/feed/tag/llm' },
  { name: 'dev.to machinelearning', url: 'https://dev.to/feed/tag/machinelearning' },
  { name: 'dev.to openai',       url: 'https://dev.to/feed/tag/openai' },
  { name: 'dev.to claudeai',     url: 'https://dev.to/feed/tag/claudeai' },
  { name: 'dev.to rag',          url: 'https://dev.to/feed/tag/rag' },
  { name: 'dev.to agents',       url: 'https://dev.to/feed/tag/agents' },
  // Medium AI tags (verified working)
  { name: 'Medium AI',           url: 'https://medium.com/feed/tag/artificial-intelligence' },
  { name: 'Medium LLM',          url: 'https://medium.com/feed/tag/llm' },
  { name: 'Medium MLOps',        url: 'https://medium.com/feed/tag/mlops' },
  { name: 'Medium GenAI',        url: 'https://medium.com/feed/tag/generative-ai' },
]

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
    const all = AUTO_APPROVE.map((s) => ({ ...s, auto: true }))
    for (const source of all) {
      try {
        const feed = await this.parser.parseURL(source.url)
        const recent = feed.items.filter(item => {
          if (!item.isoDate) return true // include if no date (can't filter)
          return new Date(item.isoDate) >= cutoff
        })
        for (const item of recent) {
          if (!item.link || !item.title) continue
          const exists = await this.postModel.findOne({ sourceUrl: item.link }).lean()
          if (exists) continue
          const tags = this.extractTags(item.title + ' ' + (item.contentSnippet ?? ''))
          const content = (item as unknown as { content?: string }).content ?? null
          try {
            await this.postModel.create({
              title: item.title,
              slug: await this.uniqueSlug(item.title),
              summary: item.contentSnippet?.slice(0, 500),
              content: content || undefined,
              sourceUrl: item.link,
              source: source.name,
              status: source.auto ? PostStatus.INGESTED_AUTO : PostStatus.INGESTED_MANUAL,
              publishedAt: source.auto ? (item.isoDate ? new Date(item.isoDate) : new Date()) : undefined,
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

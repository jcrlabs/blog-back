// Source catalogue for RSS ingestion. Every feed here was verified to be alive and updated.
// tier drives how the front groups posts; maxItems caps how much a single run can take from
// one feed, and maxPerDay caps a source name across all its feeds so high-volume community
// tags never drown the labs and researchers.

export enum SourceTier {
  LAB = 'LAB',             // official blogs from AI labs and platforms
  RESEARCH = 'RESEARCH',   // research groups and long-form technical writing
  EXPERT = 'EXPERT',       // independent practitioners and newsletters
  COMMUNITY = 'COMMUNITY', // community aggregators (dev.to, Medium, HN)
}

export interface FeedSource {
  name: string
  url: string
  tier: SourceTier
  maxItems: number
  maxPerDay?: number
}

const lab = (name: string, url: string): FeedSource => ({ name, url, tier: SourceTier.LAB, maxItems: 10 })
const research = (name: string, url: string): FeedSource => ({ name, url, tier: SourceTier.RESEARCH, maxItems: 8 })
const expert = (name: string, url: string): FeedSource => ({ name, url, tier: SourceTier.EXPERT, maxItems: 5 })
const community = (name: string, url: string, maxPerDay: number): FeedSource =>
  ({ name, url, tier: SourceTier.COMMUNITY, maxItems: 2, maxPerDay })

export const SOURCES: FeedSource[] = [
  // Labs & platforms
  // Anthropic has no official RSS; this mirror scrapes anthropic.com/news
  lab('Anthropic',       'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml'),
  lab('OpenAI',          'https://openai.com/news/rss.xml'),
  lab('Google DeepMind', 'https://deepmind.google/blog/rss.xml'),
  lab('Google AI',       'https://blog.google/technology/ai/rss/'),
  lab('Hugging Face',    'https://huggingface.co/blog/feed.xml'),
  lab('NVIDIA',          'https://blogs.nvidia.com/blog/category/generative-ai/feed/'),
  lab('AWS ML',          'https://aws.amazon.com/blogs/machine-learning/feed/'),
  lab('GitHub',          'https://github.blog/ai-and-ml/feed/'),
  lab('Cloudflare',      'https://blog.cloudflare.com/tag/ai/rss/'),
  lab('Together AI',     'https://www.together.ai/blog/rss.xml'),
  lab('Ollama',          'https://ollama.com/blog/rss.xml'),
  lab('LangChain',       'https://www.langchain.com/blog/rss.xml'),

  // Research
  research('Google Research',      'https://research.google/blog/rss/'),
  research('Berkeley AI Research', 'https://bair.berkeley.edu/blog/feed.xml'),
  research('Lilian Weng',          'https://lilianweng.github.io/index.xml'),
  research('Sebastian Raschka',    'https://magazine.sebastianraschka.com/feed'),
  research('Interconnects',        'https://www.interconnects.ai/feed'),

  // Experts & newsletters
  expert('Simon Willison',     'https://simonwillison.net/atom/everything/'),
  expert('Latent Space',       'https://www.latent.space/feed'),
  expert('Import AI',          'https://importai.substack.com/feed'),
  expert('The Sequence',       'https://thesequence.substack.com/feed'),
  expert('Eugene Yan',         'https://eugeneyan.com/rss/'),
  expert('Hamel Husain',       'https://hamel.dev/index.xml'),
  expert('One Useful Thing',   'https://www.oneusefulthing.org/feed'),
  expert('Andrej Karpathy',    'https://karpathy.bearblog.dev/feed/'),
  expert('Last Week in AI',    'https://lastweekin.ai/feed'),

  // Community
  community('Hacker News', 'https://hnrss.org/newest?q=LLM+OR+Claude+OR+GPT+OR+Gemini+OR+%22AI+agent%22&points=100', 20),
  community('dev.to',      'https://dev.to/feed/tag/llm', 12),
  community('dev.to',      'https://dev.to/feed/tag/ai', 12),
  community('dev.to',      'https://dev.to/feed/tag/rag', 12),
  community('dev.to',      'https://dev.to/feed/tag/agents', 12),
  community('Medium',      'https://medium.com/feed/tag/llm', 6),
  community('Medium',      'https://medium.com/feed/tag/generative-ai', 6),
]

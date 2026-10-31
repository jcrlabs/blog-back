// Pure helpers for RSS ingestion, kept free of Nest/Mongoose so they are trivially testable.

const TAG_MAP: Record<string, string[]> = {
  llm:            ['llm', 'large language model', 'language model'],
  rag:            ['rag', 'retrieval augmented', 'retrieval-augmented'],
  mcp:            ['mcp', 'model context protocol'],
  agents:         ['agent', 'agentic', 'multi-agent', 'autonomous agent'],
  'fine-tuning':  ['fine-tun', 'finetuning', 'finetune', 'lora', 'qlora'],
  prompting:      ['prompt engineering', 'few-shot', 'chain-of-thought', 'system prompt'],
  openai:         ['openai', 'gpt-4', 'gpt-5', 'chatgpt', ' o1 ', ' o3 '],
  anthropic:      ['anthropic', 'claude'],
  gemini:         ['gemini', 'deepmind'],
  mistral:        ['mistral', 'mixtral'],
  'open-source':  ['llama', 'ollama', 'hugging face', 'huggingface', 'qwen', 'deepseek', 'open-weight', 'open-source model'],
  mlops:          ['mlops', 'ml ops', 'model deployment', 'model serving', 'inference'],
  'vector-db':    ['vector database', 'vector db', 'pinecone', 'weaviate', 'chroma', 'qdrant', 'faiss', 'embedding'],
  architecture:   ['ai architecture', 'system design', 'ai system', 'ai engineer', 'ai infrastructure'],
  'ai-safety':    ['alignment', 'ai safety', 'responsible ai', 'guardrail', 'red team', 'interpretability'],
}

// Function words that are common in Spanish/Portuguese/French/Italian titles but not in English
const NON_ENGLISH_WORDS = /\b(de|del|las|los|el|para|como|con|una|uno|por|que|y|dos|das|uma|não|les|des|du|une|pour|avec|della|che|sono)\b/gi

const TRACKING_PARAMS = /^(utm_.*|ref|ref_src|source|sk|gi|fbclid|gclid)$/i

export function isNonEnglish(title: string): boolean {
  // Reject non-Latin scripts (CJK, Arabic, Cyrillic, Hebrew, Thai, etc.)
  const nonLatin = (title.match(/[Ѐ-ӿ֐-ۿऀ-ॿ฀-๿　-鿿가-힯豈-﫿]/g) ?? []).length
  if (nonLatin / title.length > 0.05) return true
  // Reject Latin-script non-English: accented characters typical of Spanish, Portuguese, French, German, etc.
  const accented = (title.match(/[áàâãäåéèêëíìîïóòôõöúùûüýÿñçæœÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝŸÑÇÆŒ]/g) ?? []).length
  if (accented / title.length > 0.06) return true
  // Short accent-light titles ("Formas lógicas como plan de ejecución") slip through; count function words
  const words = title.split(/\s+/).length
  const hits = (title.match(NON_ENGLISH_WORDS) ?? []).length
  return hits >= 2 && hits / words >= 0.15
}

// Drops tracking params and fragments but keeps meaningful query strings (e.g. ?id=, ?v=).
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key)
    }
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

export function extractTags(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `
  const found = new Set<string>()
  for (const [tag, keywords] of Object.entries(TAG_MAP)) {
    if (keywords.some((k) => lower.includes(k))) found.add(tag)
  }
  // "rag" as a substring matches words like "storage" or "leverage"; require a whole word
  if (found.has('rag') && !/\brag\b|retrieval/.test(lower)) found.delete('rag')
  return [...found]
}

import { describe, it, expect } from 'vitest'
import { extractTags, isNonEnglish, normalizeUrl } from './feed-utils'
import { SOURCES } from './sources'


describe('normalizeUrl', () => {
  it('strips tracking params and fragments', () => {
    expect(normalizeUrl('https://a.dev/post?utm_source=rss&utm_medium=feed#top')).toBe('https://a.dev/post')
  })

  it('keeps meaningful query params', () => {
    expect(normalizeUrl('https://news.ycombinator.com/item?id=123&ref=rss')).toBe('https://news.ycombinator.com/item?id=123')
  })
})

describe('extractTags', () => {
  it('detects topics', () => {
    expect(extractTags('Building a RAG agent with Claude')).toEqual(expect.arrayContaining(['rag', 'agents', 'anthropic']))
  })

  it('does not tag rag on substrings like storage', () => {
    expect(extractTags('Leverage cheap storage')).not.toContain('rag')
  })
})

describe('SOURCES', () => {
  it('has unique feed urls', () => {
    const urls = SOURCES.map((s) => s.url)
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('isNonEnglish', () => {
  it('rejects accent-light Spanish titles', () => {
    expect(isNonEnglish('Formas lógicas como plan de ejecución: dentro del solver de KAG')).toBe(true)
  })

  it('keeps English titles that contain an odd function word', () => {
    expect(isNonEnglish('Building a RAG pipeline with Claude and the Model Context Protocol')).toBe(false)
    expect(isNonEnglish('Gemini 4 Argon in Real Use: Heavy on Tokens, and the Price Doubles Dec 1')).toBe(false)
    expect(isNonEnglish('Prospero is a C++ coding harness for local LLMs')).toBe(false)
    expect(isNonEnglish('How do I do evals for agents? Le Chat vs Il Mio and La Plateforme')).toBe(false)
  })
})

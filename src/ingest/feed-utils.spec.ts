import { describe, it, expect } from 'vitest'
import { extractTags, normalizeUrl } from './feed-utils'
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

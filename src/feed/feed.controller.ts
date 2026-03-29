import { Controller, Get, Header } from '@nestjs/common'
import { PostsService } from '../posts/posts.service'

@Controller()
export class FeedController {
  constructor(private postsService: PostsService) {}

  @Get('rss.xml')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  async rss() {
    const posts = await this.postsService.findPublished(undefined, { first: 20 })
    const items = posts
      .map(
        (p) => `
        <item>
          <title><![CDATA[${p.title}]]></title>
          <description><![CDATA[${p.summary ?? ''}]]></description>
          <link>${p.sourceUrl ?? `https://tech-blog.jcrlabs.net/post/${p.slug}`}</link>
          <pubDate>${new Date(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate>
          ${p.source ? `<source url="${p.sourceUrl ?? ''}">${p.source}</source>` : ''}
        </item>`,
      )
      .join('')

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>JCRLabs Tech Blog</title>
    <link>https://tech-blog.jcrlabs.net</link>
    <description>Kubernetes, DevOps, Cloud Native — curated and original content</description>
    <language>en</language>
    ${items}
  </channel>
</rss>`
  }
}

import { Controller, Get, Header } from '@nestjs/common'
import { PostsService } from '../posts/posts.service'

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

@Controller()
export class FeedController {
  constructor(private postsService: PostsService) {}

  @Get('rss.xml')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  async rss() {
    const posts = await this.postsService.findPublished(undefined, { first: 50 })
    const items = posts
      .map(
        (p) => `
        <item>
          <title><![CDATA[${p.title}]]></title>
          <description><![CDATA[${p.summary ?? ''}]]></description>
          <link>${xml(p.sourceUrl ?? `https://tech-blog.jcrlabs.net/post/${p.slug}`)}</link>
          <pubDate>${new Date(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate>
          ${p.source ? `<source url="${xml(p.sourceUrl ?? '')}">${xml(p.source)}</source>` : ''}
        </item>`,
      )
      .join('')

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI·feed — jcrlabs</title>
    <link>https://tech-blog.jcrlabs.net</link>
    <description>AI engineering news from labs, researchers and the community, curated hourly</description>
    <language>en</language>
    ${items}
  </channel>
</rss>`
  }
}

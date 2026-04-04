import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IngestService } from './ingest.service'

@Controller('ingest')
export class IngestController {
  constructor(
    private ingestService: IngestService,
    private cfg: ConfigService,
  ) {}

  @Post('trigger')
  async trigger(@Headers('x-admin-secret') secret: string) {
    const expected = this.cfg.get<string>('ADMIN_SECRET')
    if (!expected || secret !== expected) throw new UnauthorizedException()
    void this.ingestService.ingestFeeds()
    return { queued: true }
  }
}

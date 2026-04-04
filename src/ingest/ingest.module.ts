import { Module } from '@nestjs/common'
import { PostsModule } from '../posts/posts.module'
import { IngestService } from './ingest.service'
import { IngestController } from './ingest.controller'

@Module({ imports: [PostsModule], providers: [IngestService], controllers: [IngestController] })
export class IngestModule {}

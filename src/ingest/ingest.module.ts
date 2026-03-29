import { Module } from '@nestjs/common'
import { PostsModule } from '../posts/posts.module'
import { IngestService } from './ingest.service'

@Module({ imports: [PostsModule], providers: [IngestService] })
export class IngestModule {}

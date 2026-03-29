import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { GraphQLModule } from '@nestjs/graphql'
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo'
import { ScheduleModule } from '@nestjs/schedule'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { PostsModule } from './posts/posts.module'
import { CategoriesModule } from './categories/categories.module'
import { TagsModule } from './tags/tags.module'
import { MediaModule } from './media/media.module'
import { FeedModule } from './feed/feed.module'
import { IngestModule } from './ingest/ingest.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      context: ({ req }: { req: unknown }) => ({ req }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    PostsModule,
    CategoriesModule,
    TagsModule,
    MediaModule,
    FeedModule,
    IngestModule,
    HealthModule,
  ],
})
export class AppModule {}

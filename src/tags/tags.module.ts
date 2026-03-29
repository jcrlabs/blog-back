import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Tag, TagSchema } from './schemas/tag.schema'
import { TagsService } from './tags.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Tag.name, schema: TagSchema }])],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}

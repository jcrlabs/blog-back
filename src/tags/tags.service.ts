import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Tag, type TagDocument } from './schemas/tag.schema'

@Injectable()
export class TagsService {
  constructor(@InjectModel(Tag.name) private model: Model<TagDocument>) {}
  findAll() { return this.model.find().lean().exec() }
  findBySlug(slug: string) { return this.model.findOne({ slug }).lean().exec() }
  async findOrCreate(name: string): Promise<TagDocument> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const existing = await this.model.findOne({ slug }).exec()
    if (existing) return existing
    return this.model.create({ name, slug })
  }
}

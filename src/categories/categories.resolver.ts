import { Resolver, Query } from '@nestjs/graphql'
import { CategoriesService } from './categories.service'
import { CategoryType } from './dto/category.type'
import { Public } from '../common/decorators/public.decorator'

@Resolver()
export class CategoriesResolver {
  constructor(private svc: CategoriesService) {}
  @Public()
  @Query(() => [CategoryType])
  async categories(): Promise<CategoryType[]> {
    const docs = await this.svc.findAll()
    return docs.map((d) => ({ ...d, id: d._id.toString() })) as CategoryType[]
  }
}

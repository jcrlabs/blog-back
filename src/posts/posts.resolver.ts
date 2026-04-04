import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql'
import { UseGuards } from '@nestjs/common'
import { PostsService } from './posts.service'
import { PostType } from './dto/post.type'
import { CreatePostInput } from './dto/create-post.input'
import { PostFilterInput } from './dto/post-filter.input'
import { PaginationInput } from '../common/pagination/pagination.input'
import { GqlAuthGuard } from '../common/guards/gql-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles, Role } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Public } from '../common/decorators/public.decorator'

interface AuthUser { id: string; role: Role }

@Resolver(() => PostType)
@UseGuards(GqlAuthGuard, RolesGuard)
export class PostsResolver {
  constructor(private postsService: PostsService) {}

  @Public()
  @Query(() => [PostType])
  async posts(
    @Args('filter', { nullable: true }) filter?: PostFilterInput,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ): Promise<PostType[]> {
    const docs = await this.postsService.findPublished(filter, pagination)
    return docs.map((d) => ({ ...d, id: d._id.toString(), tagNames: d.tagNames ?? [] })) as PostType[]
  }

  @Public()
  @Query(() => PostType, { nullable: true })
  async post(@Args('slug') slug: string): Promise<PostType | null> {
    const doc = await this.postsService.findBySlug(slug)
    if (!doc) return null
    return { ...doc, id: doc._id.toString(), tagNames: doc.tagNames ?? [] } as PostType
  }

  @Roles(Role.ADMIN, Role.AUTHOR)
  @Mutation(() => PostType)
  async createPost(
    @Args('input') input: CreatePostInput,
    @CurrentUser() user: AuthUser,
  ): Promise<PostType> {
    const doc = await this.postsService.create(input, user.id)
    return { ...doc.toObject(), id: doc._id.toString(), tagNames: [] } as PostType
  }

  @Roles(Role.ADMIN)
  @Mutation(() => PostType)
  async publishPost(@Args('id', { type: () => ID }) id: string): Promise<PostType | null> {
    const doc = await this.postsService.publish(id)
    return doc ? ({ ...doc.toObject(), id: doc._id.toString(), tagNames: [] } as PostType) : null
  }

  @Roles(Role.ADMIN)
  @Mutation(() => PostType)
  async unpublishPost(@Args('id', { type: () => ID }) id: string): Promise<PostType | null> {
    const doc = await this.postsService.unpublish(id)
    return doc ? ({ ...doc.toObject(), id: doc._id.toString(), tagNames: [] } as PostType) : null
  }

  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  deletePost(@Args('id', { type: () => ID }) id: string) {
    return this.postsService.delete(id)
  }
}

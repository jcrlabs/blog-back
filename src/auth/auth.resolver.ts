import { Resolver, Mutation, Query, Args } from '@nestjs/graphql'
import { UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { AuthResponse } from './dto/auth-response.type'
import { LoginInput } from './dto/login.input'
import { Public } from '../common/decorators/public.decorator'
import { GqlAuthGuard } from '../common/guards/gql-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ObjectType, Field, ID } from '@nestjs/graphql'

@ObjectType()
class MeType {
  @Field(() => ID)
  id: string

  @Field()
  email: string

  @Field()
  role: string
}

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 900_000, limit: 5 } })
  @Mutation(() => AuthResponse)
  login(@Args('input') input: LoginInput) {
    return this.authService.login(input.email, input.password)
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => MeType)
  me(@CurrentUser() user: { id: string; email: string; role: string }): MeType {
    return { id: user.id, email: user.email, role: user.role }
  }
}

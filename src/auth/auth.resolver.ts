import { Resolver, Mutation, Args } from '@nestjs/graphql'
import { AuthService } from './auth.service'
import { AuthResponse } from './dto/auth-response.type'
import { LoginInput } from './dto/login.input'
import { Public } from '../common/decorators/public.decorator'

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Public()
  @Mutation(() => AuthResponse)
  login(@Args('input') input: LoginInput) {
    return this.authService.login(input.email, input.password)
  }
}

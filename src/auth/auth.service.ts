import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { UsersService } from '../users/users.service'
import type { UserDocument } from '../users/schemas/user.schema'

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private cfg: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email)
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials')
    }
    return this.generateTokens(user)
  }

  generateTokens(user: UserDocument) {
    const payload = { sub: user._id.toString(), email: user.email, role: user.role }
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: this.cfg.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    }
  }
}

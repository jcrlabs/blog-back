import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as bcrypt from 'bcrypt'
import { User, type UserDocument } from './schemas/user.schema'

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private model: Model<UserDocument>) {}

  findByEmail(email: string) {
    return this.model.findOne({ email }).exec()
  }

  async create(email: string, password: string, name: string) {
    const hashed = await bcrypt.hash(password, 12)
    return this.model.create({ email, password: hashed, name })
  }
}

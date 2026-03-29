import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type UserDocument = User & Document

export enum UserRole {
  ADMIN = 'admin',
  AUTHOR = 'author',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string

  @Prop({ required: true })
  password: string

  @Prop({ required: true })
  name: string

  @Prop({ type: String, enum: UserRole, default: UserRole.AUTHOR })
  role: UserRole
}

export const UserSchema = SchemaFactory.createForClass(User)

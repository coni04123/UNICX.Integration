import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EntityDocument = Entity & Document;

export enum EntityType {
  ENTITY = 'entity',
  COMPANY = 'company',
  DEPARTMENT = 'department',
}

@Schema({ timestamps: true })
export class Entity {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, enum: EntityType })
  type: EntityType;

  @Prop({ type: Types.ObjectId, ref: 'Entity', default: null })
  parentId: Types.ObjectId;

  @Prop({ required: true })
  path: string;

  @Prop({ required: true, default: 0 })
  level: number;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop({ required: true })
  createdBy: string;

  @Prop()
  updatedBy: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const EntitySchema = SchemaFactory.createForClass(Entity);

// Indexes for performance
EntitySchema.index({ isActive: 1 });
EntitySchema.index({ parentId: 1 });
EntitySchema.index({ path: 1 });
EntitySchema.index({ type: 1 });
EntitySchema.index({ level: 1 });

// Virtual for children
EntitySchema.virtual('children', {
  ref: 'Entity',
  localField: '_id',
  foreignField: 'parentId',
});

EntitySchema.set('toJSON', { virtuals: true });
EntitySchema.set('toObject', { virtuals: true });

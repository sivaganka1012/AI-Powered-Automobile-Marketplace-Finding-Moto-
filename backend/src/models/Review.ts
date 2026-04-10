import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReview extends Document {
  productId?: Types.ObjectId;
  sellerId?: Types.ObjectId;
  mechanicId?: Types.ObjectId;
  buyer: Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    mechanicId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    buyer: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

reviewSchema.index(
  { productId: 1, buyer: 1 },
  {
    unique: true,
    partialFilterExpression: {
      productId: { $exists: true, $ne: null },
      buyer: { $exists: true },
    },
  }
);

reviewSchema.index(
  { sellerId: 1, buyer: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sellerId: { $exists: true, $ne: null },
      buyer: { $exists: true },
    },
  }
);

reviewSchema.index(
  { mechanicId: 1, buyer: 1 },
  {
    unique: true,
    partialFilterExpression: {
      mechanicId: { $exists: true, $ne: null },
      buyer: { $exists: true },
    },
  }
);

const Review = mongoose.model<IReview>('Review', reviewSchema);
export default Review;

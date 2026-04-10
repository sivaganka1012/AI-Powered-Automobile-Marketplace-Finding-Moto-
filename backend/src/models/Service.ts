import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IService extends Document {
  _id: mongoose.Types.ObjectId;
  mechanic: mongoose.Types.ObjectId;
  name: string;
  description: string;
  price: number;
  duration: string;
  category: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    mechanic: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    duration: {
      type: String,
      required: [true, 'Duration is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index for quick lookups by mechanic
serviceSchema.index({ mechanic: 1, active: 1 });

const Service: Model<IService> = mongoose.model<IService>('Service', serviceSchema);
export default Service;

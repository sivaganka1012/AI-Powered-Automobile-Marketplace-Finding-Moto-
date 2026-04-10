import mongoose, { Document, Schema, Model } from 'mongoose';

export type ProductStatus = 'active' | 'inactive' | 'out_of_stock';
export type ProductType = 'product' | 'service';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  seller: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  originalPrice?: number;
  stock: number;
  images: string[];
  status: ProductStatus;
  views: number;
  sales: number;
  sku?: string;
  type: ProductType;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    brand: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    originalPrice: {
      type: Number,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'out_of_stock'],
      default: 'active',
    },
    views: {
      type: Number,
      default: 0,
    },
    sales: {
      type: Number,
      default: 0,
    },
    sku: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['product', 'service'],
      default: 'product',
    },
    embedding: {
      type: [Number],
      default: [],
    },
  },
  { timestamps: true }
);

// Auto-set status to out_of_stock when stock hits 0
productSchema.pre('save', function (next) {
  if (this.stock === 0 && this.status === 'active') {
    this.status = 'out_of_stock';
  }
  if (this.stock > 0 && this.status === 'out_of_stock') {
    this.status = 'active';
  }
  next();
});

const Product: Model<IProduct> = mongoose.model<IProduct>('Product', productSchema);
export default Product;

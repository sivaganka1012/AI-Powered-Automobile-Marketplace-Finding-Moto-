import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// Role types
export type UserRole = 'buyer' | 'seller' | 'mechanic' | 'admin';

// Approval status types (for seller and mechanic)
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// Interface for User document
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  googleId?: string | null;
  avatar?: string | null;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  approvalNotes?: string;
  approvedAt?: Date;
  isActive: boolean;
  isEmailVerified: boolean;
  otp?: string | null;
  otpExpires?: Date | null;
  // Seller-specific fields
  shopName?: string;
  shopDescription?: string;
  shopLocation?: string;
  sellerSpecializations?: string[];
  sellerBrands?: string[];
  // Mechanic-specific fields
  specialization?: string;
  experienceYears?: number;
  workshopLocation?: string;
  workshopName?: string;
  fullName: string;
  createdAt: Date;
  updatedAt: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
  canLogin(): boolean;
  getApprovalMessage(): string;
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, 'Please add a first name'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Please add a last name'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please add a valid email']
    },
    password: {
      type: String,
      minlength: 6,
      select: false
    },
    phone: {
      type: String,
      trim: true,
      default: null
    },
    address: {
      type: String,
      trim: true,
      default: null
    },
    googleId: {
      type: String,
      default: null
    },
    avatar: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ['buyer', 'seller', 'mechanic', 'admin'],
      default: 'buyer'
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved'
    },
    approvalNotes: {
      type: String,
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    otp: {
      type: String,
      default: null
    },
    otpExpires: {
      type: Date,
      default: null
    },
    // Seller-specific fields
    shopName: {
      type: String,
      trim: true,
      default: null
    },
    shopDescription: {
      type: String,
      trim: true,
      default: null
    },
    shopLocation: {
      type: String,
      trim: true,
      default: null
    },
    sellerSpecializations: {
      type: [String],
      default: [],
    },
    sellerBrands: {
      type: [String],
      default: [],
    },
    // Mechanic-specific fields
    specialization: {
      type: String,
      trim: true,
      default: null
    },
    experienceYears: {
      type: Number,
      default: null
    },
    workshopLocation: {
      type: String,
      trim: true,
      default: null
    },
    workshopName: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index: same email can have different roles
userSchema.index({ email: 1, role: 1 }, { unique: true });

// Virtual for full name
userSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Set approval status based on role before saving new users
userSchema.pre('save', async function (next) {
  // Hash password if modified
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Set approval status for new users based on role
  if (this.isNew) {
    if (this.role === 'buyer') {
      this.approvalStatus = 'approved';
    } else if (this.role === 'seller' || this.role === 'mechanic') {
      this.approvalStatus = 'pending';
    } else if (this.role === 'admin') {
      this.approvalStatus = 'approved';
    }
  }

  next();
});

// Match password
userSchema.methods.matchPassword = async function (
  this: IUser,
  enteredPassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user can login based on approval status
userSchema.methods.canLogin = function (this: IUser): boolean {
  if (!this.isActive) return false;
  // Buyers and admins can always login
  if (this.role === 'buyer' || this.role === 'admin') return true;
  // Sellers and mechanics need approval
  return this.approvalStatus === 'approved';
};

// Get approval message
userSchema.methods.getApprovalMessage = function (this: IUser): string {
  if (this.role === 'buyer') {
    return 'Welcome! Your account is ready to use.';
  }
  if (this.approvalStatus === 'pending') {
    return 'Your account is pending admin approval. You will be notified once approved.';
  }
  if (this.approvalStatus === 'rejected') {
    return `Your account was not approved. ${this.approvalNotes || 'Please contact support for more information.'}`;
  }
  if (this.approvalStatus === 'approved') {
    return 'Your account has been approved! Welcome to Finding Moto.';
  }
  return 'Account status unknown. Please contact support.';
};

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;

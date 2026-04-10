import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import config from '../src/config';

dotenv.config();

const sampleUsers = [
  // ─── Sellers ──────────────────────────────────────────────────────
  {
    firstName: 'Kamal',
    lastName: 'Perera',
    email: 'seller@gmail.com',
    password: 'seller123',
    phone: '+94 77 123 4567',
    role: 'seller' as const,
    isEmailVerified: true,
    isActive: true,
    approvalStatus: 'approved' as const,
    approvedAt: new Date(),
    shopName: 'Kamal Auto Parts',
    shopDescription: 'Premium quality spare parts for Japanese and European vehicles. Over 10 years in the automobile spare parts industry.',
    shopLocation: 'No. 45, Galle Road, Colombo 03',
  },
  {
    firstName: 'Nimal',
    lastName: 'Silva',
    email: 'seller2@gmail.com',
    password: 'seller123',
    phone: '+94 71 234 5678',
    role: 'seller' as const,
    isEmailVerified: true,
    isActive: true,
    approvalStatus: 'approved' as const,
    approvedAt: new Date(),
    shopName: 'Silva Motors & Parts',
    shopDescription: 'Authorized dealer for Honda, Toyota, and Suzuki spare parts. Genuine and aftermarket parts available.',
    shopLocation: '12/B, Kandy Road, Peradeniya',
  },

  // ─── Mechanics ────────────────────────────────────────────────────
  {
    firstName: 'Ruwan',
    lastName: 'Fernando',
    email: 'mechanic@gmail.com',
    password: 'mechanic123',
    phone: '+94 76 345 6789',
    role: 'mechanic' as const,
    isEmailVerified: true,
    isActive: true,
    approvalStatus: 'approved' as const,
    approvedAt: new Date(),
    specialization: 'Engine & Transmission',
    experienceYears: 12,
    workshopName: 'Fernando Auto Care',
    workshopLocation: '78, Main Street, Galle',
  },
  {
    firstName: 'Saman',
    lastName: 'Kumara',
    email: 'mechanic2@gmail.com',
    password: 'mechanic123',
    phone: '+94 70 456 7890',
    role: 'mechanic' as const,
    isEmailVerified: true,
    isActive: true,
    approvalStatus: 'approved' as const,
    approvedAt: new Date(),
    specialization: 'Electrical & Diagnostics',
    experienceYears: 8,
    workshopName: 'Kumara Auto Electrical',
    workshopLocation: '56, Temple Road, Matara',
  },
];

const seedUsers = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoURI);
    console.log('MongoDB Connected');

    for (const userData of sampleUsers) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`✓ Already exists: ${existing.email} (${existing.role})`);
      } else {
        const user = await User.create(userData);
        // Force approval status to 'approved' since pre-save hook sets it to 'pending'
        await User.updateOne(
          { _id: user._id },
          { $set: { approvalStatus: 'approved', approvedAt: new Date() } }
        );
        console.log(`✓ Created: ${user.email} (${user.role})`);
      }
    }

    console.log('\n── Sample Credentials ──────────────────────');
    console.log('Seller 1:   seller@gmail.com    / seller123');
    console.log('Seller 2:   seller2@gmail.com   / seller123');
    console.log('Mechanic 1: mechanic@gmail.com  / mechanic123');
    console.log('Mechanic 2: mechanic2@gmail.com / mechanic123');
    console.log('────────────────────────────────────────────\n');

    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
};

seedUsers();

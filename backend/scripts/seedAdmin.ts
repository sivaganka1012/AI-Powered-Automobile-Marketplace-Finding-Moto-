import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import config from '../src/config';

dotenv.config();

const seedAdmin = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoURI);
    console.log('MongoDB Connected');

    const adminEmail = 'admin@findingmoto.com';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Admin user already exists:');
      console.log(`  Email: ${existingAdmin.email}`);
      console.log(`  Role: ${existingAdmin.role}`);
      console.log(`  Active: ${existingAdmin.isActive}`);
      console.log(`  Email Verified: ${existingAdmin.isEmailVerified}`);

      // Ensure the existing admin has correct flags and reset password
      const adminUser = await User.findById(existingAdmin._id).select('+password');
      if (adminUser) {
        adminUser.isEmailVerified = true;
        adminUser.isActive = true;
        adminUser.role = 'admin';
        adminUser.approvalStatus = 'approved';
        adminUser.password = 'Admin@123'; // Will be hashed by pre-save hook
        await adminUser.save();
        console.log('Updated admin flags and reset password.');
      }
    } else {
      // Create admin user
      const admin = await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@findingmoto.com',
        password: 'Admin@123',
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
        approvalStatus: 'approved'
      });

      console.log('Admin user created successfully!');
      console.log(`  Email: ${admin.email}`);
      console.log(`  Password: Admin@123 (hashed in DB)`);
      console.log(`  Role: ${admin.role}`);
    }

    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();

import mongoose from 'mongoose';
import config from '../config';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(config.mongoURI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Migrate: drop old unique index on email alone (now compound email+role)
    try {
      const collection = conn.connection.collection('users');
      const indexes = await collection.indexes();
      const oldEmailIndex = indexes.find(
        (idx: any) => idx.key?.email && !idx.key?.role && idx.unique
      );
      if (oldEmailIndex && oldEmailIndex.name) {
        await collection.dropIndex(oldEmailIndex.name);
        console.log('Dropped old unique email index (migrated to email+role)');
      }
    } catch (indexErr: any) {
      // Index may already be gone — ignore
      if (indexErr?.code !== 27) {
        console.warn('Index migration note:', indexErr?.message);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
};

export default connectDB;

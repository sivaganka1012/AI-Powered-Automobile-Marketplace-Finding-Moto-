import dotenv from 'dotenv';
import connectDB from '../src/utils/db';
import Product from '../src/models/Product';
import { canUseEmbeddings, refreshProductEmbedding } from '../src/utils/embeddings';

dotenv.config();

const run = async (): Promise<void> => {
  if (!canUseEmbeddings()) {
    console.error('OPENAI_KEY is missing. Cannot backfill embeddings.');
    process.exit(1);
  }

  await connectDB();

  const products = await Product.find({ status: { $ne: 'inactive' } });
  console.log(`Found ${products.length} products for embedding backfill.`);

  let updated = 0;
  for (const product of products) {
    await refreshProductEmbedding(product);
    await product.save();
    updated += 1;

    if (updated % 20 === 0) {
      console.log(`Processed ${updated}/${products.length}`);
    }
  }

  console.log(`Backfill completed. Updated ${updated} products.`);
  process.exit(0);
};

run().catch((error) => {
  console.error('Embedding backfill failed:', error);
  process.exit(1);
});

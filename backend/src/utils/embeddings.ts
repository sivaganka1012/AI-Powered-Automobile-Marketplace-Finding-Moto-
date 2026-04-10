import OpenAI from 'openai';
import Product, { IProduct } from '../models/Product';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY || '' });

export const canUseEmbeddings = (): boolean => {
  return Boolean(process.env.OPENAI_KEY);
};

export const buildProductEmbeddingText = (product: Pick<IProduct, 'name' | 'description' | 'category' | 'brand'>): string => {
  return [
    `name: ${product.name || ''}`,
    `category: ${product.category || ''}`,
    `brand: ${product.brand || ''}`,
    `description: ${product.description || ''}`,
  ].join('\n');
};

export const createEmbedding = async (input: string): Promise<number[]> => {
  const value = input.trim();
  if (!value) return [];

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: value,
  });

  return response.data[0]?.embedding || [];
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

export const refreshProductEmbedding = async (product: IProduct): Promise<void> => {
  if (!canUseEmbeddings()) return;

  const text = buildProductEmbeddingText(product);
  product.embedding = await createEmbedding(text);
};

export const refreshProductEmbeddingById = async (productId: string): Promise<void> => {
  if (!canUseEmbeddings()) return;

  const product = await Product.findById(productId);
  if (!product) return;

  await refreshProductEmbedding(product);
  await product.save();
};

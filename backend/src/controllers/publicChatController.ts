import { Request, Response } from 'express';
import OpenAI from 'openai';
import Product from '../models/Product';
import { canUseEmbeddings, cosineSimilarity, createEmbedding } from '../utils/embeddings';

type ChatRequest = {
  message: string;
};

type ChatResponse = {
  reply: string;
};

type ProductCandidate = {
  name: string;
  price: number;
  stock: number;
  embedding: number[];
  description?: string;
  category?: string;
  brand?: string;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY || '',
});

export const publicChat = async (
  req: Request<{}, ChatResponse, ChatRequest>,
  res: Response<ChatResponse>
): Promise<void> => {
  try {
    const userMessage = req.body?.message?.trim();

    if (!userMessage) {
      res.status(400).json({ reply: 'Message is required.' });
      return;
    }

    if (!process.env.OPENAI_KEY) {
      res.status(500).json({ reply: 'OPENAI_KEY is missing in server environment.' });
      return;
    }

    // Step 1: AI intent extraction
    const ai = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content:
            'Extract key bike product search terms (bike model, part name, category) from the user message. Return only concise search text.',
        },
        { role: 'user', content: userMessage },
      ],
    });

    const intent = ai.choices[0]?.message?.content?.trim() || userMessage;

    let product: ProductCandidate | null = null;

    // Step 2a: Semantic search using product embeddings
    if (canUseEmbeddings()) {
      const queryEmbedding = await createEmbedding(intent || userMessage);

      const candidates = (await Product.find({
        status: { $ne: 'inactive' },
        embedding: { $exists: true, $ne: [] },
      })
        .select('name price stock embedding description category brand')
        .lean()) as unknown as ProductCandidate[];

      let bestScore = 0;
      let bestProduct: ProductCandidate | null = null;

      candidates.forEach((candidate) => {
        const score = cosineSimilarity(queryEmbedding, candidate.embedding || []);
        if (score > bestScore) {
          bestScore = score;
          bestProduct = candidate;
        }
      });

      // Tuned threshold to avoid irrelevant matches
      if (bestProduct && bestScore >= 0.35) {
        product = bestProduct;
      }
    }

    // Step 2b: Fallback regex search when semantic search has no confident match
    if (!product) {
      product = (await Product.findOne({
        $or: [
          { name: { $regex: intent, $options: 'i' } },
          { description: { $regex: intent, $options: 'i' } },
          { category: { $regex: intent, $options: 'i' } },
          { brand: { $regex: intent, $options: 'i' } },
        ],
        status: { $ne: 'inactive' },
      })
        .select('name price stock description category brand')
        .lean()) as unknown as ProductCandidate | null;
    }

    // Step 3: Response
    if (product) {
      res.json({
        reply: `Yes, we have ${product.name} for Rs.${product.price}. Stock: ${product.stock}`,
      });
      return;
    }

    res.json({
      reply: 'Sorry, product not available.',
    });
  } catch (error) {
    console.error('publicChat error:', error);
    res.status(500).json({
      reply: 'Server error.',
    });
  }
};

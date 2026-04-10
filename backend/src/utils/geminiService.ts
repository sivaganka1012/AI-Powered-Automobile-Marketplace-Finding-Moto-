import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiMemorySnapshot } from './geminiMemory';

export type GeminiUserRole = 'buyer' | 'mechanic' | 'seller';

const NON_BIKE_REPLY = 'This chatbot only supports bike and bike spare parts topics.';
const STRICT_UNRELATED_REPLY = 'This chatbot is only for bike marketplace support. Unrelated messages are not allowed.';

const roleInstructions: Record<GeminiUserRole, string> = {
  buyer:
    'Buyer role: help with motorcycle issues, diagnosis, maintenance guidance, spare parts, buying and selling support, and bike price prediction.',
  mechanic:
    'Mechanic role: help with motorcycle repair tips, service estimates, maintenance plans, and spare parts recommendations only.',
  seller:
    'Seller role: help with motorcycle product pricing, listing optimization, and bike-focused selling tips only.',
};

const bikeCoreKeywords = [
  'bike', 'motorcycle', 'motorbike', 'scooter', 'engine', 'mileage', 'noise', 'service', 'repair', 'spare',
  'parts', 'brake', 'chain', 'clutch', 'spark plug', 'oil', 'gear', 'tyre', 'tire', 'suspension', 'fuel',
  'buy', 'sell', 'price', 'pricing', 'diagnosis', 'maintenance',
];

const roleKeywords: Record<GeminiUserRole, string[]> = {
  buyer: [
    'issue', 'problem', 'diagnosis', 'predict', 'prediction', 'buy', 'purchase', 'resale', 'best bike',
    'mileage', 'noise', 'engine', 'price', 'estimate',
  ],
  mechanic: [
    'repair', 'fix', 'diagnose', 'service', 'cost', 'quote', 'labour', 'labor', 'replace', 'workshop',
    'tools', 'parts', 'maintenance',
  ],
  seller: [
    'price', 'pricing', 'listing', 'sell', 'selling', 'marketplace', 'stock', 'inventory', 'margin',
    'profit', 'customer', 'conversion', 'demand',
  ],
};

const romanticAbusiveOrPersonalPatterns: RegExp[] = [
  /\bi\s*love\s*you\b/i,
  /\blove\b/i,
  /\bromance\b/i,
  /\bromantic\b/i,
  /\bfriend(ship)?\b/i,
  /\bpersonal\s+chat\b/i,
  /\bhow\s+are\s+you\b/i,
  /\bdate\b/i,
  /\bsex\b/i,
  /\bsexy\b/i,
  /\bfuck\b/i,
  /\bshit\b/i,
  /\bbitch\b/i,
  /\bidiot\b/i,
  /\bstupid\b/i,
];

const disallowedDomainPatterns: RegExp[] = [
  /\bcar\b/i,
  /\bcars\b/i,
  /\bsuv\b/i,
  /\bvan\b/i,
  /\bbus\b/i,
  /\btruck\b/i,
  /\b4\s*-?\s*wheeler\b/i,
  /\bfour\s*-?\s*wheeler\b/i,
  /\bev\s*car\b/i,
  /\bpolitics?\b/i,
  /\breligion\b/i,
  /\bnews\b/i,
];

const illegalMechanicPatterns: RegExp[] = [
  /\bremove\s+(the\s+)?catalytic\s+converter\b/i,
  /\bdisable\s+abs\b/i,
  /\btamper\b/i,
  /\bbypass\s+inspection\b/i,
  /\bstolen\b/i,
  /\bchange\s+(the\s+)?engine\s+number\b/i,
  /\bchange\s+(the\s+)?chassis\s+number\b/i,
];

export const sanitizeGeminiMessage = (message: string): string => {
  return message
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
};

const containsKeyword = (message: string, keywords: string[]): boolean => {
  const lower = message.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
};

interface ModerationResult {
  allowed: boolean;
  fallbackReply?: string;
}

export const evaluateGeminiPolicy = (message: string, role: GeminiUserRole): ModerationResult => {
  if (romanticAbusiveOrPersonalPatterns.some((pattern) => pattern.test(message))) {
    return {
      allowed: false,
      fallbackReply: STRICT_UNRELATED_REPLY,
    };
  }

  if (disallowedDomainPatterns.some((pattern) => pattern.test(message))) {
    return {
      allowed: false,
      fallbackReply: NON_BIKE_REPLY,
    };
  }

  if (role === 'mechanic' && illegalMechanicPatterns.some((pattern) => pattern.test(message))) {
    return {
      allowed: false,
      fallbackReply: STRICT_UNRELATED_REPLY,
    };
  }

  if (!containsKeyword(message, bikeCoreKeywords)) {
    return {
      allowed: false,
      fallbackReply: NON_BIKE_REPLY,
    };
  }

  if (!containsKeyword(message, roleKeywords[role])) {
    return {
      allowed: false,
      fallbackReply: STRICT_UNRELATED_REPLY,
    };
  }

  return { allowed: true };
};

const normalizeForSimilarity = (text: string): string => {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

const toWordSet = (text: string): Set<string> => {
  const words = normalizeForSimilarity(text)
    .split(' ')
    .filter((word) => word.length > 2);
  return new Set(words);
};

const isTooSimilar = (nextReply: string, previousReply: string): boolean => {
  const a = normalizeForSimilarity(nextReply);
  const b = normalizeForSimilarity(previousReply);
  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  const setA = toWordSet(a);
  const setB = toWordSet(b);
  if (setA.size === 0 || setB.size === 0) {
    return false;
  }

  let overlap = 0;
  for (const word of setA) {
    if (setB.has(word)) {
      overlap += 1;
    }
  }

  const ratioA = overlap / setA.size;
  const ratioB = overlap / setB.size;
  return ratioA >= 0.85 && ratioB >= 0.85;
};

const shouldRegenerate = (reply: string, previousReplies: string[]): boolean => {
  return previousReplies.some((previous) => isTooSimilar(reply, previous));
};

export const createGeminiService = (apiKey: string) => {
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const generateReply = async (message: string, role: GeminiUserRole, context: GeminiMemorySnapshot): Promise<string> => {
    const contextUserMessages = context.userMessages.length > 0
      ? context.userMessages.map((item, index) => `${index + 1}. ${item}`).join('\n')
      : 'None';
    const contextBotReplies = context.botReplies.length > 0
      ? context.botReplies.map((item, index) => `${index + 1}. ${item}`).join('\n')
      : 'None';

    const policyPrompt = [
      'You are an AI assistant for a BIKE marketplace.',
      'Follow rules strictly and answer in short, clear, bike-focused language.',
      'Allowed: motorcycles only, bike engine/noise/mileage issues, maintenance/repair, spare parts, bike buying/selling, bike price prediction.',
      'Not allowed: cars/SUVs/vans/buses/trucks/4-wheelers/EV cars, romance, friendship, personal chat, abuse, politics, religion, news, and anything unrelated to bikes.',
      `Role logic: ${roleInstructions[role]}`,
      'Use conversation context: last 3 user messages and last 2 bot messages.',
      'Do not repeat previous answers. Always provide a fresh variation.',
      'If request is unsafe or outside bike scope, respond with concise bike-only refusal.',
      '',
      'Conversation memory:',
      `Last 3 user messages:\n${contextUserMessages}`,
      `Last 2 bot messages:\n${contextBotReplies}`,
      '',
      `Current user message:\n${message}`,
    ].join('\n');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const antiRepeatHint = attempt > 0 ? '\nAvoid wording used in your previous answer attempt.' : '';
      const prompt = `${policyPrompt}${antiRepeatHint}`;

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 220,
        },
      });

      const reply = result.response.text().trim();
      if (!reply) {
        continue;
      }

      if (shouldRegenerate(reply, context.botReplies)) {
        continue;
      }

      return reply;
    }

    throw new Error('Empty or repetitive response from Gemini model.');
  };

  return { generateReply };
};
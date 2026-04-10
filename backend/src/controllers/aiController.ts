import { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config';
import { AuthRequest } from '../middleware/auth';
import Product from '../models/Product';
import Order from '../models/Order';
import Review from '../models/Review';
import Service from '../models/Service';
import mongoose from 'mongoose';

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

type ChatRole = 'buyer' | 'seller' | 'mechanic';

const GEMINI_MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

const GLOBAL_REJECTION_MESSAGE =
  'This chatbot is only for bike marketplace support. Please avoid unrelated or unwanted messages.';

const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /GOCSPX-[0-9A-Za-z\-_]{10,}/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /(smtp_pass|smtp_user|jwt_secret|google_client_secret|gemini_api_key)\s*[:=]\s*[^\s]+/gi,
];

const redactSensitiveText = (value: string): string => {
  let output = value;
  SECRET_PATTERNS.forEach((pattern) => {
    output = output.replace(pattern, '[REDACTED]');
  });
  return output;
};

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'with', 'from', 'this', 'that', 'and', 'or', 'of', 'to', 'in', 'on', 'my', 'me', 'about',
  'please', 'suggest', 'need', 'help', 'price', 'pricing', 'analyze', 'analysis', 'product', 'products', 'image',
  'bike', 'motorcycle', 'spare', 'part', 'parts', 'seller', 'listing', 'market',
]);

interface ParsedImageData {
  mimeType: string;
  data: string;
}

interface SellerAnalyticsSnapshot {
  queryUsed: string;
  totalMarketplaceProducts: number;
  totalMarketplaceAvailableProducts: number;
  matchingProducts: number;
  matchingAvailableProducts: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  sellerMatchingProducts: number;
  sellerAveragePrice: number;
  sellerTotalUnitsSold: number;
  topMatchingProducts: Array<{
    name: string;
    brand: string;
    category: string;
    price: number;
    stock: number;
  }>;
}

interface SellerCurrentReport {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  averageOrderValue: number;
  reviewCount: number;
  averageRating: number;
  topSellingProducts: Array<{
    name: string;
    sales: number;
    stock: number;
    price: number;
  }>;
  lowStockList: Array<{
    name: string;
    stock: number;
  }>;
}

interface MechanicCurrentReport {
  totalServices: number;
  activeServices: number;
  totalJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  totalRevenue: number;
  monthlyRevenue: number;
  averageJobValue: number;
  reviewCount: number;
  averageRating: number;
  topRequestedServices: Array<{
    name: string;
    requests: number;
  }>;
}

const roleGuidance: Record<ChatRole, string> = {
  buyer:
    'You are Finding Moto AI assistant for buyers. Help with bike problems, price estimates, spare parts, and buying tips only.',
  seller:
    'You are Finding Moto AI assistant for sellers. Help with listing quality, selling price, margins, spare parts pricing, and marketplace growth only.',
  mechanic:
    'You are Finding Moto AI assistant for mechanics. Help with legal repair, diagnostics, service pricing, tools, and spare parts only.',
};

const roleKeywords: Record<ChatRole, string[]> = {
  buyer: [
    'bike', 'motorcycle', 'scooter', 'problem', 'issue', 'noise', 'vibration', 'overheat', 'starting',
    'price', 'estimate', 'cost', 'budget', 'buy', 'purchase', 'tips', 'spare', 'part', 'brake', 'chain',
    'filter', 'engine', 'tyre', 'tire', 'helmet', 'compatible',
  ],
  mechanic: [
    'repair', 'diagnosis', 'diagnose', 'service', 'servicing', 'tool', 'tools', 'spare', 'part', 'replace',
    'fix', 'maintenance', 'engine', 'brake', 'clutch', 'chain', 'suspension', 'electrical', 'cost', 'quote',
    'labour', 'labor', 'workshop',
  ],
  seller: [
    'sell', 'selling', 'price', 'pricing', 'listing', 'title', 'description', 'inventory', 'stock',
    'margin', 'profit', 'spare', 'part', 'bike', 'motorcycle', 'product', 'marketplace', 'discount',
    'competitive',
  ],
};





const abusiveOrUnwantedPatterns: RegExp[] = [
  /\bi\s*love\s*you\b/i,
  /\blove\s+you\b/i,
  /\bromance\b/i,
  /\bromantic\b/i,
  /\bdate\b/i,
  /\bsex\b/i,
  /\bfuck\b/i,
  /\bshit\b/i,
  /\bbitch\b/i,
  /\bidiot\b/i,
  /\bstupid\b/i,
  /\bkill\s+yourself\b/i,
];

const illegalMechanicPatterns: RegExp[] = [
  /\bremove\s+(the\s+)?catalytic\s+converter\b/i,
  /\btamper\b/i,
  /\bfake\s+emission\b/i,
  /\bdisable\s+abs\b/i,
  /\bbypass\s+inspection\b/i,
  /\bstolen\b/i,
  /\bchassis\s+number\b.*\bchange\b/i,
  /\bengine\s+number\b.*\bchange\b/i,
];

const containsAnyKeyword = (message: string, keywords: string[]): boolean => {
  const lower = message.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
};

const safeRound = (value: number): number => Math.round(value * 100) / 100;

const extractSearchTerms = (input: string): string[] => {
  const terms = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));

  return Array.from(new Set(terms)).slice(0, 6);
};

const buildRegexFromTerms = (terms: string[]): RegExp => {
  const escapedTerms = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const expression = escapedTerms.length > 0 ? escapedTerms.join('|') : 'bike';
  return new RegExp(expression, 'i');
};

const parseImageDataUrl = (value?: string): ParsedImageData | undefined => {
  if (!value || typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return undefined;
  }

  const mimeType = match[1];
  const data = match[2];

  if (data.length > 10_000_000) {
    return undefined;
  }

  return { mimeType, data };
};

const REPORT_KEYWORDS = [
  'report', 'current report', 'sales report', 'stock report', 'inventory report',
  'review report', 'summary', 'analytics', 'dashboard', 'today report', 'monthly report',
];

const isSellerReportRequest = (message: string): boolean => {
  const lower = message.toLowerCase();
  return REPORT_KEYWORDS.some((keyword) => lower.includes(keyword));
};

const isMechanicReportRequest = (message: string): boolean => {
  const lower = message.toLowerCase();
  return REPORT_KEYWORDS.some((keyword) => lower.includes(keyword));
};

const formatLkr = (value: number): string => `LKR ${Math.round(value).toLocaleString()}`;

const getSellerCurrentReport = async (sellerId: mongoose.Types.ObjectId): Promise<SellerCurrentReport> => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    products,
    totalOrders,
    pendingOrders,
    completedOrders,
    revenueAgg,
    monthlyRevenueAgg,
    ordersForAverage,
  ] = await Promise.all([
    Product.find({ seller: sellerId, type: 'product' })
      .select('name price stock status sales')
      .lean(),
    Order.countDocuments({ seller: sellerId }),
    Order.countDocuments({ seller: sellerId, status: 'pending' }),
    Order.countDocuments({ seller: sellerId, status: { $in: ['delivered', 'confirmed', 'shipped'] } }),
    Order.aggregate([
      { $match: { seller: sellerId, status: { $in: ['delivered', 'confirmed', 'shipped'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.aggregate([
      {
        $match: {
          seller: sellerId,
          status: { $in: ['delivered', 'confirmed', 'shipped'] },
          createdAt: { $gte: monthStart },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.find({ seller: sellerId, status: { $in: ['delivered', 'confirmed', 'shipped'] } })
      .select('totalAmount')
      .lean(),
  ]);

  const productIds = products.map((p) => p._id);
  const reviews = productIds.length > 0
    ? await Review.find({ productId: { $in: productIds } }).select('rating').lean()
    : [];

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.status === 'active').length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5);
  const outOfStockProducts = products.filter((p) => p.stock === 0 || p.status === 'out_of_stock').length;

  const totalRevenue = revenueAgg?.[0]?.total ?? 0;
  const monthlyRevenue = monthlyRevenueAgg?.[0]?.total ?? 0;
  const averageOrderValue = ordersForAverage.length > 0
    ? ordersForAverage.reduce((sum, order) => sum + order.totalAmount, 0) / ordersForAverage.length
    : 0;

  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0
    ? safeRound(reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount)
    : 0;

  const topSellingProducts = [...products]
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      sales: p.sales,
      stock: p.stock,
      price: p.price,
    }));

  const lowStockList = lowStock
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      stock: p.stock,
    }));

  return {
    totalProducts,
    activeProducts,
    lowStockProducts: lowStock.length,
    outOfStockProducts,
    totalOrders,
    pendingOrders,
    completedOrders,
    totalRevenue,
    monthlyRevenue,
    averageOrderValue,
    reviewCount,
    averageRating,
    topSellingProducts,
    lowStockList,
  };
};

const buildSellerCurrentReportText = (report: SellerCurrentReport): string => {
  const topProductsText = report.topSellingProducts.length > 0
    ? report.topSellingProducts
      .map((p, i) => `${i + 1}. ${p.name} | Sold: ${p.sales} | Stock: ${p.stock} | ${formatLkr(p.price)}`)
      .join('\n')
    : 'No product sales yet.';

  const lowStockText = report.lowStockList.length > 0
    ? report.lowStockList.map((p, i) => `${i + 1}. ${p.name} (Stock: ${p.stock})`).join('\n')
    : 'No low-stock products right now.';

  return [
    'Seller Current Report (Live Data)',
    '',
    `Sales: Total Orders ${report.totalOrders} | Pending ${report.pendingOrders} | Completed ${report.completedOrders}`,
    `Revenue: Total ${formatLkr(report.totalRevenue)} | This Month ${formatLkr(report.monthlyRevenue)} | Avg Order ${formatLkr(report.averageOrderValue)}`,
    `Stock: Total Products ${report.totalProducts} | Active ${report.activeProducts} | Low Stock ${report.lowStockProducts} | Out of Stock ${report.outOfStockProducts}`,
    `Reviews: Total ${report.reviewCount} | Average Rating ${report.averageRating}/5`,
    '',
    'Top Selling Products:',
    topProductsText,
    '',
    'Low Stock Alerts:',
    lowStockText,
  ].join('\n');
};

const getMechanicCurrentReport = async (mechanicId: mongoose.Types.ObjectId): Promise<MechanicCurrentReport> => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalServices,
    activeServices,
    totalJobs,
    pendingJobs,
    confirmedJobs,
    shippedJobs,
    completedJobs,
    revenueAgg,
    monthlyRevenueAgg,
    jobValues,
    topRequestedServices,
    mechanicProducts,
  ] = await Promise.all([
    Service.countDocuments({ mechanic: mechanicId }),
    Service.countDocuments({ mechanic: mechanicId, active: true }),
    Order.countDocuments({ seller: mechanicId }),
    Order.countDocuments({ seller: mechanicId, status: 'pending' }),
    Order.countDocuments({ seller: mechanicId, status: 'confirmed' }),
    Order.countDocuments({ seller: mechanicId, status: 'shipped' }),
    Order.countDocuments({ seller: mechanicId, status: 'delivered' }),
    Order.aggregate([
      { $match: { seller: mechanicId, status: { $in: ['delivered', 'confirmed', 'shipped'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.aggregate([
      {
        $match: {
          seller: mechanicId,
          status: { $in: ['delivered', 'confirmed', 'shipped'] },
          createdAt: { $gte: monthStart },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Order.find({ seller: mechanicId, status: { $in: ['delivered', 'confirmed', 'shipped'] } })
      .select('totalAmount')
      .lean(),
    Order.aggregate([
      { $match: { seller: mechanicId } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', requests: { $sum: '$items.qty' } } },
      { $sort: { requests: -1 } },
      { $limit: 5 },
    ]),
    Product.find({ seller: mechanicId }).select('_id').lean(),
  ]);

  const productIds = mechanicProducts.map((p) => p._id);
  const reviews = productIds.length > 0
    ? await Review.find({ productId: { $in: productIds } }).select('rating').lean()
    : [];

  const totalRevenue = revenueAgg?.[0]?.total ?? 0;
  const monthlyRevenue = monthlyRevenueAgg?.[0]?.total ?? 0;
  const averageJobValue = jobValues.length > 0
    ? jobValues.reduce((sum, item) => sum + item.totalAmount, 0) / jobValues.length
    : 0;

  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0
    ? safeRound(reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount)
    : 0;

  return {
    totalServices,
    activeServices,
    totalJobs,
    pendingJobs,
    inProgressJobs: confirmedJobs + shippedJobs,
    completedJobs,
    totalRevenue,
    monthlyRevenue,
    averageJobValue,
    reviewCount,
    averageRating,
    topRequestedServices: topRequestedServices.map((item) => ({
      name: String(item._id || 'Service'),
      requests: Number(item.requests || 0),
    })),
  };
};

const buildMechanicCurrentReportText = (report: MechanicCurrentReport): string => {
  const topServicesText = report.topRequestedServices.length > 0
    ? report.topRequestedServices
      .map((item, index) => `${index + 1}. ${item.name} | Requests: ${item.requests}`)
      .join('\n')
    : 'No service request data yet.';

  return [
    'Mechanic Current Report (Live Data)',
    '',
    `Jobs: Total ${report.totalJobs} | Pending ${report.pendingJobs} | In Progress ${report.inProgressJobs} | Completed ${report.completedJobs}`,
    `Services: Total ${report.totalServices} | Active ${report.activeServices}`,
    `Revenue: Total ${formatLkr(report.totalRevenue)} | This Month ${formatLkr(report.monthlyRevenue)} | Avg Job ${formatLkr(report.averageJobValue)}`,
    `Reviews: Total ${report.reviewCount} | Average Rating ${report.averageRating}/5`,
    '',
    'Top Requested Services:',
    topServicesText,
  ].join('\n');
};

const computeMedian = (numbers: number[]): number => {
  if (numbers.length === 0) {
    return 0;
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return safeRound((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return safeRound(sorted[mid]);
};

const getSellerAnalyticsSnapshot = async (
  sellerId: mongoose.Types.ObjectId,
  message: string,
  productHint?: string
): Promise<SellerAnalyticsSnapshot> => {
  const queryUsed = (productHint || message).trim();
  const terms = extractSearchTerms(queryUsed);
  const matcher = buildRegexFromTerms(terms);

  const [totalMarketplaceProducts, totalMarketplaceAvailableProducts, matchingDocs, sellerMatchingDocs, sellerUnitsSoldAggregate] = await Promise.all([
    Product.countDocuments({ type: 'product' }),
    Product.countDocuments({ type: 'product', stock: { $gt: 0 }, status: 'active' }),
    Product.find({
      type: 'product',
      $or: [
        { name: matcher },
        { category: matcher },
        { brand: matcher },
      ],
    })
      .select('name brand category price stock')
      .sort({ sales: -1, createdAt: -1 })
      .limit(120)
      .lean(),
    Product.find({
      seller: sellerId,
      type: 'product',
      $or: [
        { name: matcher },
        { category: matcher },
        { brand: matcher },
      ],
    })
      .select('price')
      .lean(),
    Order.aggregate([
      { $match: { seller: sellerId, status: { $in: ['delivered', 'confirmed', 'shipped'] } } },
      { $unwind: '$items' },
      {
        $match: {
          $or: [
            { 'items.name': matcher },
          ],
        },
      },
      { $group: { _id: null, totalQty: { $sum: '$items.qty' } } },
    ]),
  ]);

  const prices = matchingDocs.map((p) => p.price).filter((price): price is number => Number.isFinite(price));
  const avg = prices.length > 0 ? safeRound(prices.reduce((sum, price) => sum + price, 0) / prices.length) : 0;
  const min = prices.length > 0 ? Math.min(...prices) : 0;
  const max = prices.length > 0 ? Math.max(...prices) : 0;
  const median = computeMedian(prices);

  const sellerPrices = sellerMatchingDocs.map((p) => p.price).filter((price): price is number => Number.isFinite(price));
  const sellerAveragePrice = sellerPrices.length > 0 ? safeRound(sellerPrices.reduce((sum, price) => sum + price, 0) / sellerPrices.length) : 0;
  const matchingAvailableProducts = matchingDocs.filter((doc) => doc.stock > 0).length;

  return {
    queryUsed,
    totalMarketplaceProducts,
    totalMarketplaceAvailableProducts,
    matchingProducts: matchingDocs.length,
    matchingAvailableProducts,
    averagePrice: avg,
    minPrice: safeRound(min),
    maxPrice: safeRound(max),
    medianPrice: median,
    sellerMatchingProducts: sellerMatchingDocs.length,
    sellerAveragePrice,
    sellerTotalUnitsSold: sellerUnitsSoldAggregate?.[0]?.totalQty ?? 0,
    topMatchingProducts: matchingDocs.slice(0, 5).map((doc) => ({
      name: doc.name,
      brand: doc.brand || 'N/A',
      category: doc.category,
      price: safeRound(doc.price),
      stock: doc.stock,
    })),
  };
};

const isGlobalBlockedMessage = (message: string): boolean => {
  return abusiveOrUnwantedPatterns.some((pattern) => pattern.test(message));
};

const getRoleRedirectMessage = (role: ChatRole): string => {
  if (role === 'buyer') {
    return 'I can help only with bike problems, price estimation, spare parts, and buying tips for buyers.';
  }
  if (role === 'mechanic') {
    return 'I can help only with repair, tools, spare parts, and service cost topics for mechanics.';
  }
  return 'I can help only with selling price, listing details, and spare parts pricing for sellers.';
};

const toTitleCase = (value: string): string => {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const extractSellerDescriptionTarget = (message: string): { product: string; vehicle: string } => {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ');
  const brandHints = ['bajaj', 'honda', 'yamaha', 'suzuki', 'tvs', 'hero', 'kawasaki', 'ktm'];
  const brandIndex = words.findIndex((word) => brandHints.includes(word.toLowerCase()));

  if (brandIndex > 0) {
    return {
      product: toTitleCase(words.slice(0, brandIndex).join(' ')),
      vehicle: toTitleCase(words.slice(brandIndex).join(' ')),
    };
  }

  return {
    product: 'Spare Part',
    vehicle: 'Motorcycle Models',
  };
};

const buildFriendlyFallback = (role: ChatRole, message: string): string => {
  const lower = message.toLowerCase();

  if (role === 'seller' && (lower.includes('description') || lower.includes('product') || lower.includes('write') || lower.includes('discription'))) {
    const { product, vehicle } = extractSellerDescriptionTarget(message);
    return `Product Description: ${product} - ${vehicle}\n\nPremium ${product} designed for ${vehicle}. Built for durability, smooth performance, and reliable fitment for everyday riding.\n\nKey Highlights:\n- Quality-tested material and finish\n- Practical value for both retail and workshop buyers\n- Fitment support for listed compatible models\n\nSeller Tip: Add exact model year compatibility and clear photos to increase buyer trust and conversion.`;
  }

  if (role === 'seller' && (lower.includes('price') || lower.includes('pricing') || lower.includes('cost'))) {
    return 'Pricing suggestion:\n- Budget tier: keep margin around 20-25%\n- Standard tier: keep margin around 30-35%\n- Premium tier: keep margin around 40%+ with warranty\n\nShare your part name, brand, and cost price and I will calculate exact selling prices.';
  }

  if (role === 'mechanic') {
    return 'I can help with repair guidance, diagnostics, tool lists, and service cost ranges. Tell me the bike model, issue symptoms, and when it started for a more accurate step-by-step answer.';
  }

  return 'I can help with bike parts, buying tips, repair guidance, and price estimates. Tell me your bike model and what you need, and I will give a clear recommendation.';
};

const getScopeRedirectInsteadOfBlock = (role: ChatRole): string => {
  if (role === 'buyer') {
    return 'I can help with bike problems, price estimation, spare parts, and buying tips. Please ask a bike-related question and include your model for better accuracy.';
  }
  if (role === 'mechanic') {
    return 'I can help with legal repair, diagnostics, tools, spare parts, and service costs. Share the bike model and issue details to continue.';
  }
  return 'I can help with selling price, product descriptions, listing quality, and marketplace sales tips for bike parts. Share your product and vehicle model to continue.';
};

const buildPrompt = (role: ChatRole, message: string, sellerSnapshot?: SellerAnalyticsSnapshot, hasImage?: boolean): string => {
  const guidance = roleGuidance[role];
  const sellerBlock = role === 'seller' && sellerSnapshot
    ? [
        'Seller marketplace analytics from current website data:',
        `- Query: ${sellerSnapshot.queryUsed}`,
        `- Matching products: ${sellerSnapshot.matchingProducts}`,
        `- Matching products in stock: ${sellerSnapshot.matchingAvailableProducts}`,
        `- Marketplace average price: LKR ${sellerSnapshot.averagePrice.toLocaleString()}`,
        `- Marketplace median price: LKR ${sellerSnapshot.medianPrice.toLocaleString()}`,
        `- Marketplace min-max: LKR ${sellerSnapshot.minPrice.toLocaleString()} - ${sellerSnapshot.maxPrice.toLocaleString()}`,
        `- Seller matching listings: ${sellerSnapshot.sellerMatchingProducts}`,
        `- Seller average listed price: LKR ${sellerSnapshot.sellerAveragePrice.toLocaleString()}`,
        `- Seller sold units (matched keywords): ${sellerSnapshot.sellerTotalUnitsSold}`,
        `- Total marketplace products: ${sellerSnapshot.totalMarketplaceProducts}`,
        `- Total active in-stock products: ${sellerSnapshot.totalMarketplaceAvailableProducts}`,
        '- Top matching products:',
        ...sellerSnapshot.topMatchingProducts.map(
          (item, index) => `  ${index + 1}. ${item.name} | ${item.brand} | ${item.category} | LKR ${item.price.toLocaleString()} | Stock ${item.stock}`
        ),
      ].join('\n')
    : '';

  return [
    guidance,
    'Response rules:',
    '- Be friendly and practical.',
    '- Keep response under 10 lines unless user asks for details.',
    '- For seller pricing questions, always give 3 selling price options: budget, recommended, premium.',
    '- If seller analytics are provided, base your recommendation on those numbers and mention stock availability in one short line.',
    '- Never expose, repeat, or guess secrets, keys, passwords, emails, tokens, or credentials.',
    '- If no similar product data exists, clearly state that and give a conservative estimate with assumptions.',
    hasImage ? '- The user attached a product image. Use it to infer product type, visible condition, and listing quality tips.' : '- If no image is provided, focus on text and marketplace data only.',
    '- If user message is vague, ask one clarifying question first.',
    '- Never mention being offline or fallback.',
    '',
    sellerBlock,
    sellerBlock ? '' : '',
    `User question: ${message}`,
  ].join('\n');
};

const generateLiveGeminiReply = async (apiKey: string, parts: GeminiPart[]): Promise<string> => {
  const client = new GoogleGenerativeAI(apiKey);
  let lastError = 'Unknown Gemini error';

  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: parts as any,
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 700,
        },
      } as any);

      const text = result.response.text().trim();
      if (text) {
        return text;
      }
      lastError = `Empty response from model ${modelName}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`Gemini request failed for model ${modelName}:`, lastError);
    }
  }

  throw new Error(lastError);
};

export const askAI = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role as ChatRole | undefined;
    const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
    const { message, role, imageDataUrl, productName } = req.body as {
      message?: string;
      role?: ChatRole;
      imageDataUrl?: string;
      productName?: string;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    if (!userRole || !['buyer', 'seller', 'mechanic'].includes(userRole)) {
      res.status(403).json({ success: false, message: 'AI chatbot is available only for buyer, seller, and mechanic roles.' });
      return;
    }

    const cleanMessage = message.trim();
    const parsedImage = parseImageDataUrl(imageDataUrl);

    if (isGlobalBlockedMessage(cleanMessage)) {
      res.json({ success: true, data: { answer: GLOBAL_REJECTION_MESSAGE } });
      return;
    }

    if (role && role !== userRole) {
      res.json({ success: true, data: { answer: getRoleRedirectMessage(userRole) } });
      return;
    }

    if (userRole === 'mechanic' && illegalMechanicPatterns.some((pattern) => pattern.test(cleanMessage))) {
      res.json({
        success: true,
        data: { answer: 'I can help with legal and safe repairs only. Please ask about standard repair, tools, spare parts, or service costs.' },
      });
      return;
    }

    if (userRole === 'mechanic' && userId && isMechanicReportRequest(cleanMessage)) {
      const currentReport = await getMechanicCurrentReport(userId);
      res.json({
        success: true,
        data: {
          answer: buildMechanicCurrentReportText(currentReport),
          report: currentReport,
        },
      });
      return;
    }

    if (userRole === 'seller' && userId && isSellerReportRequest(cleanMessage)) {
      const currentReport = await getSellerCurrentReport(userId);
      res.json({
        success: true,
        data: {
          answer: buildSellerCurrentReportText(currentReport),
          report: currentReport,
        },
      });
      return;
    }

    if (!containsAnyKeyword(cleanMessage, roleKeywords[userRole]) && !((userRole === 'seller' || userRole === 'mechanic') && parsedImage)) {
      res.json({ success: true, data: { answer: getScopeRedirectInsteadOfBlock(userRole) } });
      return;
    }

    if (!config.geminiApiKey) {
      res.json({
        success: true,
        data: {
          answer: `${buildFriendlyFallback(userRole, cleanMessage)}\n\n(Live AI is temporarily unavailable. Showing smart offline guidance.)`,
        },
      });
      return;
    }

    let sellerSnapshot: SellerAnalyticsSnapshot | undefined;
    if (userRole === 'seller' && userId) {
      sellerSnapshot = await getSellerAnalyticsSnapshot(userId, cleanMessage, productName);
    }

    const prompt = buildPrompt(userRole, cleanMessage, sellerSnapshot, !!parsedImage);

    const parts: GeminiPart[] = [{ text: prompt }];
    if (parsedImage) {
      parts.push({
        inlineData: {
          mimeType: parsedImage.mimeType,
          data: parsedImage.data,
        },
      });
    }

    let answer = 'I could not generate a response right now. Please try again.';
    try {
      answer = await generateLiveGeminiReply(config.geminiApiKey, parts);
    } catch (liveError) {
      const reason = liveError instanceof Error ? liveError.message : String(liveError);
      console.error('All Gemini model attempts failed:', reason);
      res.json({
        success: true,
        data: {
          answer: `${buildFriendlyFallback(userRole, cleanMessage)}\n\n(Live AI is temporarily unavailable. Showing smart offline guidance.)`,
        },
      });
      return;
    }

    const safeAnswer = redactSensitiveText(answer);

    res.json({
      success: true,
      data: {
        answer: safeAnswer,
        analytics: userRole === 'seller' ? sellerSnapshot : undefined,
      },
    });
  } catch (error) {
    console.error('askAI error:', error);
    const role = (req.user?.role as ChatRole | undefined) || 'buyer';
    const message = (req.body as { message?: string })?.message || '';
    res.json({
      success: true,
      data: {
        answer: `${buildFriendlyFallback(role, message)}\n\n(There was a temporary server issue. Showing smart offline guidance.)`,
      },
    });
  }
};

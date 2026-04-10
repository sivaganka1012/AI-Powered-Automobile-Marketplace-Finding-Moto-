// ─── Product Management Controller — Arun ──────────────────────────────────
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Product from '../models/Product';
import mongoose from 'mongoose';
import { refreshProductEmbedding } from '../utils/embeddings';

// @desc    Get seller's products (paginated, filterable)
// @route   GET /api/products/seller
// @access  Private/Seller
export const getProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user!._id as mongoose.Types.ObjectId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const query: Record<string, unknown> = { seller: sellerId };
    if (status && status !== 'all') query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: products,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getProducts error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a new product
// @route   POST /api/products/seller
// @access  Private/Seller
export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user!._id;
    const { name, description, category, brand, price, originalPrice, stock, images, sku, type } = req.body;

    const product = await Product.create({
      seller: sellerId,
      name,
      description,
      category,
      brand,
      price,
      originalPrice,
      stock: type === 'service' ? 99 : (stock ?? 0),
      images: images ?? [],
      sku,
      type: type || 'product',
    });

    await refreshProductEmbedding(product);
    await product.save();

    res.status(201).json({ success: true, data: product });
  } catch (err: unknown) {
    console.error('createProduct error:', err);
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ValidationError') {
      res.status(400).json({ success: false, message: (err as Error).message });
      return;
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a product
// @route   PUT /api/products/seller/:id
// @access  Private/Seller
export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user!._id;
    const { id } = req.params;

    const product = await Product.findOne({ _id: id, seller: sellerId });
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const allowedFields = [
      'name', 'description', 'category', 'brand', 'price', 'originalPrice',
      'stock', 'images', 'status', 'sku', 'type',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (product as unknown as Record<string, unknown>)[field] = req.body[field];
      }
    });

    await product.save();

    if (
      req.body.name !== undefined ||
      req.body.description !== undefined ||
      req.body.category !== undefined ||
      req.body.brand !== undefined
    ) {
      await refreshProductEmbedding(product);
      await product.save();
    }

    res.json({ success: true, data: product });
  } catch (err) {
    console.error('updateProduct error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/seller/:id
// @access  Private/Seller
export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user!._id;
    const { id } = req.params;

    const product = await Product.findOneAndDelete({ _id: id, seller: sellerId });
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    console.error('deleteProduct error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
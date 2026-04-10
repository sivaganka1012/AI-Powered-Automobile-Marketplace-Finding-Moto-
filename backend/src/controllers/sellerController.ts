// ─── Seller Dashboard Controller — Thulax ──────────────────────────────────
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Product from '../models/Product';
import Order from '../models/Order';
import Review from '../models/Review';
import mongoose from 'mongoose';

// ─── Overview / Stats ──────────────────────────────────────────────────────

export const getOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user!._id as mongoose.Types.ObjectId;

    const [
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      deliveredOrders,
      revenueResult,
      viewsResult,
    ] = await Promise.all([
      Product.countDocuments({ seller: sellerId }),
      Product.countDocuments({ seller: sellerId, status: 'active' }),
      Order.countDocuments({ seller: sellerId }),
      Order.countDocuments({ seller: sellerId, status: 'pending' }),
      Order.countDocuments({ seller: sellerId, status: 'delivered' }),
      Order.aggregate([
        { $match: { seller: sellerId, status: { $in: ['delivered', 'confirmed', 'shipped'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Product.aggregate([
        { $match: { seller: sellerId } },
        { $group: { _id: null, total: { $sum: '$views' } } },
      ]),
    ]);

    const revenue = revenueResult[0]?.total ?? 0;
    const totalViews = viewsResult[0]?.total ?? 0;

    // Recent orders (last 5)
    const recentOrders = await Order.find({ seller: sellerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('buyer', 'firstName lastName email')
      .lean();

    // Top products by sales
    const topProducts = await Product.find({ seller: sellerId })
      .sort({ sales: -1 })
      .limit(5)
      .lean();

    res.json({
      success: true,
      data: {
        stats: {
          revenue,
          totalOrders,
          pendingOrders,
          deliveredOrders,
          totalProducts,
          activeProducts,
          totalViews,
        },
        recentOrders,
        topProducts,
      },
    });
  } catch (err) {
    console.error('getOverview error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Analytics ─────────────────────────────────────────────────────────────

export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user!._id as mongoose.Types.ObjectId;

    // Last 7 days daily revenue
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyRevenue = await Order.aggregate([
      {
        $match: {
          seller: sellerId,
          status: { $in: ['delivered', 'confirmed', 'shipped'] },
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Last 30 days monthly revenue
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          seller: sellerId,
          status: { $in: ['delivered', 'confirmed', 'shipped'] },
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Orders by status
    const ordersByStatus = await Order.aggregate([
      { $match: { seller: sellerId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Top categories by revenue
    const topCategories = await Order.aggregate([
      { $match: { seller: sellerId, status: { $in: ['delivered', 'confirmed', 'shipped'] } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$productInfo.category',
          revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
          unitsSold: { $sum: '$items.qty' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      data: { dailyRevenue, monthlyRevenue, ordersByStatus, topCategories },
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Profile ───────────────────────────────────────────────────────────────

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: (user as unknown as Record<string, unknown>).avatar,
        phone: (user as unknown as Record<string, unknown>).phone,
        shopName: (user as unknown as Record<string, unknown>).shopName,
        shopDescription: (user as unknown as Record<string, unknown>).shopDescription,
        shopLocation: (user as unknown as Record<string, unknown>).shopLocation,
        sellerSpecializations: (user as unknown as Record<string, unknown>).sellerSpecializations,
        sellerBrands: (user as unknown as Record<string, unknown>).sellerBrands,
        role: user.role,
        createdAt: (user as unknown as Record<string, unknown>).createdAt,
      },
    });
  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { name, firstName, lastName, phone, shopName, shopDescription, shopLocation, sellerSpecializations, sellerBrands } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    // Support legacy 'name' field: split into firstName/lastName
    if (name && !firstName && !lastName) {
      const parts = name.trim().split(/\s+/);
      user.firstName = parts[0];
      user.lastName = parts.slice(1).join(' ') || '';
    }
    const userRecord = user as unknown as Record<string, unknown>;
    if (phone !== undefined) userRecord.phone = phone;
    if (shopName !== undefined) userRecord.shopName = shopName;
    if (shopDescription !== undefined) userRecord.shopDescription = shopDescription;
    if (shopLocation !== undefined) userRecord.shopLocation = shopLocation;
    if (sellerSpecializations !== undefined) userRecord.sellerSpecializations = Array.isArray(sellerSpecializations) ? sellerSpecializations : [];
    if (sellerBrands !== undefined) userRecord.sellerBrands = Array.isArray(sellerBrands) ? sellerBrands : [];

    await (user as unknown as { save(): Promise<unknown> }).save();

    res.json({ success: true, data: user });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Seller Reviews ────────────────────────────────────────────────────────

export const getSellerReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user!._id as mongoose.Types.ObjectId;

    // Get all product IDs owned by this seller
    const products = await Product.find({ seller: sellerId }).select('_id name').lean();
    const productIds = products.map((p) => p._id);
    const productMap = new Map(products.map((p) => [p._id.toString(), p.name]));

    // Get all reviews for those products
    const reviews = await Review.find({ productId: { $in: productIds } })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate stats
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

    // Rating distribution
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      dist[r.rating] = (dist[r.rating] || 0) + 1;
    });
    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: dist[stars],
      percentage: total > 0 ? Math.round((dist[stars] / total) * 100) : 0,
    }));

    // Recommended: count of 4-5 star reviews
    const recommended = total > 0
      ? Math.round(((dist[4] + dist[5]) / total) * 100)
      : 0;

    // Enrich reviews with product name
    const enrichedReviews = reviews.map((r) => ({
      _id: r._id,
      productId: r.productId,
      productName: r.productId ? productMap.get(r.productId.toString()) || 'Unknown Product' : 'Unknown Product',
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    }));

    res.json({
      success: true,
      data: {
        stats: { average, total, recommended },
        distribution,
        reviews: enrichedReviews,
      },
    });
  } catch (err) {
    console.error('getSellerReviews error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

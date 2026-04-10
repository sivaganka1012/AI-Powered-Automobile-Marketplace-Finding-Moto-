// ─── Public Controller — Public-facing endpoints (no auth required) ─────────
import { Request, Response } from 'express';
import Product from '../models/Product';
import Review from '../models/Review';
import User from '../models/User';
import Service from '../models/Service';
import mongoose from 'mongoose';

const PRODUCT_CATEGORY_TREE: Record<string, string[]> = {
  engine_system: ['piston', 'cylinder_block', 'crankshaft', 'camshaft', 'spark_plug'],
  fuel_system: ['fuel_injector', 'fuel_tank', 'fuel_pump', 'fuel_filter'],
  brake_system: ['brake_disc', 'brake_pad', 'brake_caliper'],
  transmission_system: ['clutch_plate', 'chain_sprocket', 'drive_chain'],
  suspension_system: ['front_fork', 'rear_shock_absorber', 'swing_arm'],
  electrical_system: ['battery', 'headlight', 'ecu', 'starter_motor', 'wiring_harness', 'indicators'],
  body_parts: ['seat', 'mirrors', 'mudguard', 'side_panel', 'number_plate_holder'],
  wheels: ['tyre', 'rim', 'spokes'],
};

const TOP_LEVEL_CATEGORIES = Object.keys(PRODUCT_CATEGORY_TREE);
const SUBCATEGORY_VALUES = TOP_LEVEL_CATEGORIES.flatMap((parent) =>
  PRODUCT_CATEGORY_TREE[parent].map((child) => `${parent}/${child}`)
);

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const enrichProductsWithReviews = async (
  products: Array<Record<string, any>>
): Promise<Array<Record<string, any>>> => {
  if (products.length === 0) {
    return [];
  }

  const productIds = products.map((p) => p._id);
  const reviewStats = await Review.aggregate([
    { $match: { productId: { $in: productIds } } },
    {
      $group: {
        _id: '$productId',
        avgRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const reviewMap = new Map(
    reviewStats.map((r) => [r._id.toString(), { avgRating: r.avgRating, reviewCount: r.reviewCount }])
  );

  return products.map((p) => {
    const stats = reviewMap.get(p._id.toString());
    return {
      ...p,
      rating: stats ? Math.round(stats.avgRating * 10) / 10 : 0,
      reviewCount: stats ? stats.reviewCount : 0,
      inStock: p.stock > 0,
      image: p.images?.[0] || null,
    };
  });
};

// @desc    Get all active products (public browsing)
// @route   GET /api/public/products
// @access  Public
export const getPublicProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const category = req.query.category as string;
    const brand = req.query.brand as string;
    const sort = req.query.sort as string;
    const minPrice = parseFloat(req.query.minPrice as string);
    const maxPrice = parseFloat(req.query.maxPrice as string);
    const inStockOnly = req.query.inStockOnly === 'true';

    // Build filter
    const filter: Record<string, unknown> = { status: { $in: ['active'] } };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (category && category !== 'All') {
      if (TOP_LEVEL_CATEGORIES.includes(category)) {
        const escaped = escapeRegex(category);
        filter.category = { $regex: `^${escaped}(/|$)`, $options: 'i' };
      } else {
        const escaped = escapeRegex(category);
        filter.category = { $regex: `^${escaped}$`, $options: 'i' };
      }
    }
    if (brand && brand !== 'All Brands') {
      filter.brand = { $regex: `^${brand}$`, $options: 'i' };
    }
    if (!isNaN(minPrice)) {
      filter.price = { ...(filter.price as object || {}), $gte: minPrice };
    }
    if (!isNaN(maxPrice)) {
      filter.price = { ...(filter.price as object || {}), $lte: maxPrice };
    }
    if (inStockOnly) {
      filter.stock = { $gt: 0 };
    }

    // Build sort
    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    switch (sort) {
      case 'price_asc':
        sortObj = { price: 1 };
        break;
      case 'price_desc':
        sortObj = { price: -1 };
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'popular':
        sortObj = { sales: -1 };
        break;
      case 'rating':
        sortObj = { sales: -1 }; // fallback, we'll sort by aggregated rating below
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('seller', 'firstName lastName shopName workshopName')
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    // Get review stats for these products
    const productIds = products.map((p) => p._id);
    const reviewStats = await Review.aggregate([
      { $match: { productId: { $in: productIds } } },
      {
        $group: {
          _id: '$productId',
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const reviewMap = new Map(
      reviewStats.map((r) => [r._id.toString(), { avgRating: r.avgRating, reviewCount: r.reviewCount }])
    );

    // Merge review data into products
    const enrichedProducts = products.map((p) => {
      const stats = reviewMap.get(p._id.toString());
      return {
        ...p,
        rating: stats ? Math.round(stats.avgRating * 10) / 10 : 0,
        reviewCount: stats ? stats.reviewCount : 0,
        inStock: p.stock > 0,
        image: p.images?.[0] || null,
      };
    });

    // Get available categories and brands for filter options
    const [categoriesList, brandsList] = await Promise.all([
      Product.distinct('category', { status: 'active' }),
      Product.distinct('brand', { status: 'active', brand: { $ne: '' } }),
    ]);

    const mergedCategories = Array.from(new Set([...TOP_LEVEL_CATEGORIES, ...SUBCATEGORY_VALUES, ...categoriesList]))
      .filter(Boolean)
      .sort();

    res.json({
      success: true,
      data: enrichedProducts,
      filters: {
        categories: ['All', ...mergedCategories],
        brands: ['All Brands', ...brandsList.sort()],
      },
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getPublicProducts error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single product detail (public)
// @route   GET /api/public/products/:id
// @access  Public
export const getPublicProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid product ID' });
      return;
    }

    const product = await Product.findOne({ _id: id, status: { $in: ['active', 'out_of_stock'] } })
      .populate('seller', 'firstName lastName shopName workshopName')
      .lean();

    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    // Increment views
    await Product.updateOne({ _id: id }, { $inc: { views: 1 } });

    // Get reviews for this product
    const reviews = await Review.find({ productId: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('buyer', 'firstName lastName avatar')
      .lean();

    const reviewStats = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const stats = reviewStats[0] || { avgRating: 0, reviewCount: 0 };

    res.json({
      success: true,
      data: {
        ...product,
        rating: Math.round(stats.avgRating * 10) / 10,
        reviewCount: stats.reviewCount,
        inStock: product.stock > 0,
        image: product.images?.[0] || null,
        reviews,
      },
    });
  } catch (err) {
    console.error('getPublicProduct error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get trending products (top rated / most sold, limit 6)
// @route   GET /api/public/products/trending
// @access  Public
export const getTrendingProducts = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get active products sorted by sales, then views
    const products = await Product.find({ status: 'active' })
      .populate('seller', 'firstName lastName shopName')
      .sort({ sales: -1, views: -1 })
      .limit(6)
      .lean();

    // Get review stats
    const productIds = products.map((p) => p._id);
    const reviewStats = await Review.aggregate([
      { $match: { productId: { $in: productIds } } },
      {
        $group: {
          _id: '$productId',
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const reviewMap = new Map(
      reviewStats.map((r) => [r._id.toString(), { avgRating: r.avgRating, reviewCount: r.reviewCount }])
    );

    const enrichedProducts = products.map((p) => {
      const stats = reviewMap.get(p._id.toString());
      return {
        ...p,
        rating: stats ? Math.round(stats.avgRating * 10) / 10 : 0,
        reviewCount: stats ? stats.reviewCount : 0,
        inStock: p.stock > 0,
        image: p.images?.[0] || null,
      };
    });

    res.json({ success: true, data: enrichedProducts });
  } catch (err) {
    console.error('getTrendingProducts error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get approved mechanics / garages (public listing)
// @route   GET /api/public/mechanics
// @access  Public
export const getPublicMechanics = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string;
    const specialization = req.query.specialization as string;

    const filter: Record<string, unknown> = {
      role: 'mechanic',
      approvalStatus: 'approved',
      isActive: true,
    };

    if (search) {
      filter.$or = [
        { workshopName: { $regex: search, $options: 'i' } },
        { workshopLocation: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
      ];
    }
    if (specialization && specialization !== 'All Services') {
      filter.specialization = { $regex: specialization, $options: 'i' };
    }

    const mechanics = await User.find(filter)
      .select('firstName lastName phone avatar specialization experienceYears workshopLocation workshopName')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch real services for each mechanic from the Service collection
    const mechanicIds = mechanics.map((m) => m._id);
    const allServices = await Service.find({ mechanic: { $in: mechanicIds }, active: true })
      .select('name mechanic category price')
      .lean();

    // Group services by mechanic id
    const serviceLookup: Record<string, { name: string; category: string; price: number }[]> = {};
    for (const svc of allServices) {
      const key = svc.mechanic.toString();
      if (!serviceLookup[key]) serviceLookup[key] = [];
      serviceLookup[key].push({ name: svc.name, category: svc.category, price: svc.price });
    }

    // Map mechanics to a garage-like shape for frontend
    const garages = mechanics.map((m) => {
      const mechServices = serviceLookup[m._id.toString()] || [];
      return {
        _id: m._id,
        name: m.workshopName || `${m.firstName} ${m.lastName}'s Workshop`,
        ownerName: `${m.firstName} ${m.lastName}`,
        address: m.workshopLocation || 'Location not specified',
        phone: m.phone || 'Not available',
        specialization: m.specialization || 'General Service',
        experienceYears: m.experienceYears || 0,
        avatar: m.avatar || null,
        services: mechServices.length > 0
          ? mechServices.map((s) => s.name)
          : (m.specialization
              ? m.specialization.split(',').map((s: string) => s.trim())
              : ['General Service']),
        serviceDetails: mechServices,
        verified: true, // approved mechanics are verified
      };
    });

    // Get distinct specializations for filter
    const specializations = await User.distinct('specialization', {
      role: 'mechanic',
      approvalStatus: 'approved',
      isActive: true,
      specialization: { $nin: [null, ''] },
    });

    res.json({
      success: true,
      data: garages,
      filters: {
        specializations: ['All Services', ...specializations.filter(Boolean).sort()],
      },
    });
  } catch (err) {
    console.error('getPublicMechanics error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get public seller profile with active products
// @route   GET /api/public/sellers/:id
// @access  Public
export const getPublicSellerProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid seller id' });
      return;
    }

    const seller = await User.findOne({
      _id: id,
      role: 'seller',
      approvalStatus: 'approved',
      isActive: true,
    })
      .select('firstName lastName phone avatar shopName shopDescription shopLocation sellerSpecializations sellerBrands')
      .lean();

    if (!seller) {
      res.status(404).json({ success: false, message: 'Seller not found' });
      return;
    }

    const products = await Product.find({ seller: seller._id, status: { $in: ['active', 'out_of_stock'] } })
      .sort({ createdAt: -1 })
      .lean();

    const enrichedProducts = await enrichProductsWithReviews(products as Array<Record<string, any>>);

    const sellerReviewStats = await Review.aggregate([
      { $match: { sellerId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const stats = sellerReviewStats[0] || { avgRating: 0, reviewCount: 0 };

    res.json({
      success: true,
      data: {
        seller: {
          ...seller,
          name: seller.shopName || `${seller.firstName} ${seller.lastName}`,
        },
        stats: {
          rating: Math.round((stats.avgRating || 0) * 10) / 10,
          reviewCount: stats.reviewCount || 0,
          productCount: enrichedProducts.length,
        },
        products: enrichedProducts,
      },
    });
  } catch (err) {
    console.error('getPublicSellerProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get public mechanic profile with services and products
// @route   GET /api/public/mechanics/:id
// @access  Public
export const getPublicMechanicProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid mechanic id' });
      return;
    }

    const mechanic = await User.findOne({
      _id: id,
      role: 'mechanic',
      approvalStatus: 'approved',
      isActive: true,
    })
      .select('firstName lastName phone avatar specialization experienceYears workshopLocation workshopName')
      .lean();

    if (!mechanic) {
      res.status(404).json({ success: false, message: 'Mechanic not found' });
      return;
    }

    const [services, products] = await Promise.all([
      Service.find({ mechanic: mechanic._id, active: true }).sort({ createdAt: -1 }).lean(),
      Product.find({ seller: mechanic._id, status: { $in: ['active', 'out_of_stock'] } }).sort({ createdAt: -1 }).lean(),
    ]);

    const enrichedProducts = await enrichProductsWithReviews(products as Array<Record<string, any>>);

    const mechanicReviewStats = await Review.aggregate([
      { $match: { mechanicId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const stats = mechanicReviewStats[0] || { avgRating: 0, reviewCount: 0 };

    res.json({
      success: true,
      data: {
        mechanic: {
          ...mechanic,
          name: mechanic.workshopName || `${mechanic.firstName} ${mechanic.lastName}`,
        },
        stats: {
          rating: Math.round((stats.avgRating || 0) * 10) / 10,
          reviewCount: stats.reviewCount || 0,
          serviceCount: services.length,
          productCount: enrichedProducts.length,
        },
        services,
        products: enrichedProducts,
      },
    });
  } catch (err) {
    console.error('getPublicMechanicProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get active services for a specific mechanic (public)
// @route   GET /api/public/mechanics/:id/services
// @access  Public
export const getPublicMechanicServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const mechanicId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(mechanicId)) {
      res.status(400).json({ success: false, message: 'Invalid mechanic id' });
      return;
    }

    const services = await Service.find({ mechanic: mechanicId, active: true })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: services });
  } catch (err) {
    console.error('getPublicMechanicServices error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all active services from all mechanics (public listing)
// @route   GET /api/public/services
// @access  Public
export const getPublicAllServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string;
    const category = req.query.category as string;

    const filter: Record<string, unknown> = { active: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }
    if (category && category !== 'All') {
      filter.category = { $regex: `^${category}$`, $options: 'i' };
    }

    const services = await Service.find(filter)
      .populate('mechanic', 'firstName lastName workshopName workshopLocation phone avatar specialization experienceYears')
      .sort({ createdAt: -1 })
      .lean();

    // Get distinct categories for filter
    const categories = await Service.distinct('category', { active: true });

    res.json({
      success: true,
      data: services,
      filters: {
        categories: ['All', ...categories.filter(Boolean).sort()],
      },
    });
  } catch (err) {
    console.error('getPublicAllServices error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

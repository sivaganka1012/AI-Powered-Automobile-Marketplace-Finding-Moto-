import { Request, Response } from 'express';
import Review from '../models/Review';
import Product from '../models/Product';
import Order from '../models/Order';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';

// Add Review
export const addReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rating, comment } = req.body;
    const { productId } = req.params;
    const buyerId = req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ message: 'Invalid product ID' });
      return;
    }

    if (!rating || rating < 1 || rating > 5 || !comment?.trim()) {
      res.status(400).json({ message: 'Rating (1-5) and comment are required' });
      return;
    }

    const product = await Product.findById(productId).select('_id');
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    // Only buyers who received the item can review it.
    const deliveredOrder = await Order.findOne({
      buyer: buyerId,
      status: 'delivered',
      'items.product': new mongoose.Types.ObjectId(productId),
    }).select('_id');

    if (!deliveredOrder) {
      res.status(403).json({ message: 'You can review only delivered purchases' });
      return;
    }

    const existing = await Review.findOne({ productId, buyer: buyerId });

    if (existing) {
      existing.rating = rating;
      existing.comment = comment.trim();
      const updated = await existing.save();
      res.json(updated);
      return;
    }

    const newReview = new Review({
      productId,
      buyer: buyerId,
      rating,
      comment: comment.trim(),
    });

    const savedReview = await newReview.save();
    res.status(201).json(savedReview);
  } catch (error) {
    res.status(500).json({ message: 'Error adding review', error });
  }
};

// Get Reviews by Product
export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ message: 'Invalid product ID' });
      return;
    }

    const reviews = await Review.find({ productId }).sort({
      createdAt: -1,
    }).populate('buyer', 'firstName lastName avatar');

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error });
  }
};

// Get logged-in buyer reviews
export const getMyReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const buyerId = req.user!._id;

    const reviews = await Review.find({ buyer: buyerId })
      .sort({ createdAt: -1 })
      .select('productId rating comment createdAt updatedAt')
      .lean();

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching your reviews', error });
  }
};

// Add Review for Seller
export const addSellerReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rating, comment } = req.body;
    const { sellerId } = req.params;
    const buyerId = req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      res.status(400).json({ message: 'Invalid seller ID' });
      return;
    }

    if (!rating || rating < 1 || rating > 5 || !comment?.trim()) {
      res.status(400).json({ message: 'Rating (1-5) and comment are required' });
      return;
    }

    // Check if seller exists
    const sellerUser = await Order.findOne({ seller: new mongoose.Types.ObjectId(sellerId) }).select('seller');
    if (!sellerUser) {
      res.status(404).json({ message: 'Seller not found' });
      return;
    }

    // Check if buyer has purchased from this seller
    const purchaseFromSeller = await Order.findOne({
      buyer: buyerId,
      seller: new mongoose.Types.ObjectId(sellerId),
      status: 'delivered',
    }).select('_id');

    if (!purchaseFromSeller) {
      res.status(403).json({ message: 'You can only review sellers you have purchased from' });
      return;
    }

    const existing = await Review.findOne({ sellerId: new mongoose.Types.ObjectId(sellerId), buyer: buyerId });

    if (existing) {
      existing.rating = rating;
      existing.comment = comment.trim();
      const updated = await existing.save();
      res.json(updated);
      return;
    }

    const newReview = new Review({
      sellerId: new mongoose.Types.ObjectId(sellerId),
      buyer: buyerId,
      rating,
      comment: comment.trim(),
    });

    const savedReview = await newReview.save();
    res.status(201).json(savedReview);
  } catch (error) {
    res.status(500).json({ message: 'Error adding seller review', error });
  }
};

// Add Review for Mechanic
export const addMechanicReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rating, comment } = req.body;
    const { mechanicId } = req.params;
    const buyerId = req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(mechanicId)) {
      res.status(400).json({ message: 'Invalid mechanic ID' });
      return;
    }

    if (!rating || rating < 1 || rating > 5 || !comment?.trim()) {
      res.status(400).json({ message: 'Rating (1-5) and comment are required' });
      return;
    }

    // Check if mechanic exists
    const mechanicUser = await Order.findOne({ seller: new mongoose.Types.ObjectId(mechanicId) }).select('seller');
    if (!mechanicUser) {
      res.status(404).json({ message: 'Mechanic not found' });
      return;
    }

    // Check if buyer has purchased from this mechanic
    const purchaseFromMechanic = await Order.findOne({
      buyer: buyerId,
      seller: new mongoose.Types.ObjectId(mechanicId),
      status: 'delivered',
    }).select('_id');

    if (!purchaseFromMechanic) {
      res.status(403).json({ message: 'You can only review mechanics you have purchased services from' });
      return;
    }

    const existing = await Review.findOne({ mechanicId: new mongoose.Types.ObjectId(mechanicId), buyer: buyerId });

    if (existing) {
      existing.rating = rating;
      existing.comment = comment.trim();
      const updated = await existing.save();
      res.json(updated);
      return;
    }

    const newReview = new Review({
      mechanicId: new mongoose.Types.ObjectId(mechanicId),
      buyer: buyerId,
      rating,
      comment: comment.trim(),
    });

    const savedReview = await newReview.save();
    res.status(201).json(savedReview);
  } catch (error) {
    res.status(500).json({ message: 'Error adding mechanic review', error });
  }
};

// Get Reviews by Seller
export const getSellerReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sellerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      res.status(400).json({ message: 'Invalid seller ID' });
      return;
    }

    const reviews = await Review.find({ sellerId: new mongoose.Types.ObjectId(sellerId) })
      .sort({ createdAt: -1 })
      .populate('buyer', 'firstName lastName avatar');

    // Calculate stats
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

    // Rating distribution
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      dist[r.rating] = (dist[r.rating] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        stats: {
          average,
          total,
          recommended: total > 0 ? Math.round(((dist[4] + dist[5]) / total) * 100) : 0,
        },
        distribution: [5, 4, 3, 2, 1].map((stars) => ({
          stars,
          count: dist[stars],
          percentage: total > 0 ? Math.round((dist[stars] / total) * 100) : 0,
        })),
        reviews,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching seller reviews', error });
  }
};

// Get Reviews by Mechanic
export const getMechanicReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mechanicId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mechanicId)) {
      res.status(400).json({ message: 'Invalid mechanic ID' });
      return;
    }

    const reviews = await Review.find({ mechanicId: new mongoose.Types.ObjectId(mechanicId) })
      .sort({ createdAt: -1 })
      .populate('buyer', 'firstName lastName avatar');

    // Calculate stats
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

    // Rating distribution
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      dist[r.rating] = (dist[r.rating] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        stats: {
          average,
          total,
          recommended: total > 0 ? Math.round(((dist[4] + dist[5]) / total) * 100) : 0,
        },
        distribution: [5, 4, 3, 2, 1].map((stars) => ({
          stars,
          count: dist[stars],
          percentage: total > 0 ? Math.round((dist[stars] / total) * 100) : 0,
        })),
        reviews,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching mechanic reviews', error });
  }
};

// Delete Review
export const deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid review ID' });
      return;
    }

    const review = await Review.findById(id);
    if (!review) {
      res.status(404).json({ message: 'Review not found' });
      return;
    }

    const isAdmin = req.user?.role === 'admin';
    const isOwner = review.buyer.toString() === req.user!._id.toString();
    if (!isAdmin && !isOwner) {
      res.status(403).json({ message: 'Not authorized to delete this review' });
      return;
    }

    await review.deleteOne();
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting review', error });
  }
};

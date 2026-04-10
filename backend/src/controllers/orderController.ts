// ─── Order Management Controller — Saran ────────────────────────────────────
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Order, { OrderStatus } from '../models/Order';
import Product from '../models/Product';
import mongoose from 'mongoose';

// ─── Buyer endpoints ────────────────────────────────────────────────────────

// @desc    Create a new order (buyer places order)
// @route   POST /api/orders
// @access  Private/Buyer
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const buyerId = req.user!._id;
    const { productId, qty, shippingAddress, paymentMethod, notes } = req.body;

    if (!productId || !shippingAddress) {
      res.status(400).json({ success: false, message: 'Product ID and shipping address are required' });
      return;
    }

    const product = await Product.findOne({ _id: productId, status: 'active' })
      .populate('seller', 'firstName lastName shopName')
      .lean();

    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found or unavailable' });
      return;
    }

    const quantity = Math.max(1, parseInt(qty) || 1);

    if (product.type !== 'service' && product.stock < quantity) {
      res.status(400).json({ success: false, message: `Only ${product.stock} items in stock` });
      return;
    }

    const totalAmount = product.price * quantity;

    const order = await Order.create({
      buyer: buyerId,
      seller: product.seller._id || product.seller,
      items: [
        {
          product: product._id,
          name: product.name,
          price: product.price,
          qty: quantity,
          image: product.images?.[0] || '',
        },
      ],
      totalAmount,
      shippingAddress,
      paymentMethod: paymentMethod || 'Cash on Delivery',
      notes: notes || '',
      statusHistory: [{ status: 'pending', changedAt: new Date(), note: 'Order placed' }],
    });

    // Decrease product stock (not for services)
    if (product.type !== 'service') {
      await Product.updateOne({ _id: productId }, { $inc: { stock: -quantity, sales: quantity } });
    } else {
      await Product.updateOne({ _id: productId }, { $inc: { sales: quantity } });
    }

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    console.error('createOrder error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get buyer's own orders
// @route   GET /api/orders/my
// @access  Private/Buyer
export const getBuyerOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const buyerId = req.user!._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const query: Record<string, unknown> = { buyer: buyerId };
    if (status && status !== 'all') query.status = status;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('seller', 'firstName lastName shopName workshopName')
        .lean(),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getBuyerOrders error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Cancel a buyer's order (only if pending)
// @route   PATCH /api/orders/my/:id/cancel
// @access  Private/Buyer
export const cancelBuyerOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const buyerId = req.user!._id;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, buyer: buyerId });
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (order.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Only pending orders can be cancelled' });
      return;
    }

    order.statusHistory.push({ status: order.status, changedAt: new Date(), note: 'Cancelled by buyer' });
    order.status = 'cancelled';
    await order.save();

    // Restore stock
    for (const item of order.items) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty, sales: -item.qty } });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    console.error('cancelBuyerOrder error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Seller endpoints ───────────────────────────────────────────────────────

// @desc    Get order statistics for seller dashboard
// @route   GET /api/orders/stats
// @access  Private/Seller
export const getOrderStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user!._id as mongoose.Types.ObjectId;

    // Current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Run all aggregations in parallel
    const [totalStats, monthlyStats, lastMonthStats, recentOrders] = await Promise.all([
      // Overall totals
      Order.aggregate([
        { $match: { seller: new mongoose.Types.ObjectId(sellerId.toString()) } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [{ $ne: ['$status', 'cancelled'] }, '$totalAmount', 0],
              },
            },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            avgOrderValue: { $avg: '$totalAmount' },
          },
        },
      ]),
      // This month stats
      Order.aggregate([
        {
          $match: {
            seller: new mongoose.Types.ObjectId(sellerId.toString()),
            createdAt: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            ordersThisMonth: { $sum: 1 },
            revenueThisMonth: {
              $sum: {
                $cond: [{ $ne: ['$status', 'cancelled'] }, '$totalAmount', 0],
              },
            },
          },
        },
      ]),
      // Last month stats (for comparison)
      Order.aggregate([
        {
          $match: {
            seller: new mongoose.Types.ObjectId(sellerId.toString()),
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        {
          $group: {
            _id: null,
            ordersLastMonth: { $sum: 1 },
            revenueLastMonth: {
              $sum: {
                $cond: [{ $ne: ['$status', 'cancelled'] }, '$totalAmount', 0],
              },
            },
          },
        },
      ]),
      // Recent 5 orders needing action (pending / confirmed)
      Order.find({
        seller: sellerId,
        status: { $in: ['pending', 'confirmed'] },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id status totalAmount createdAt')
        .lean(),
    ]);

    const total = totalStats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      pendingOrders: 0,
      avgOrderValue: 0,
    };
    const monthly = monthlyStats[0] || { ordersThisMonth: 0, revenueThisMonth: 0 };
    const lastMonth = lastMonthStats[0] || { ordersLastMonth: 0, revenueLastMonth: 0 };

    // Growth percentages
    const orderGrowth =
      lastMonth.ordersLastMonth > 0
        ? Math.round(((monthly.ordersThisMonth - lastMonth.ordersLastMonth) / lastMonth.ordersLastMonth) * 100)
        : monthly.ordersThisMonth > 0
        ? 100
        : 0;

    const revenueGrowth =
      lastMonth.revenueLastMonth > 0
        ? Math.round(((monthly.revenueThisMonth - lastMonth.revenueLastMonth) / lastMonth.revenueLastMonth) * 100)
        : monthly.revenueThisMonth > 0
        ? 100
        : 0;

    const completionRate =
      total.totalOrders > 0
        ? Math.round((total.deliveredOrders / total.totalOrders) * 100)
        : 0;

    res.json({
      success: true,
      data: {
        totalOrders: total.totalOrders,
        totalRevenue: Math.round(total.totalRevenue),
        avgOrderValue: Math.round(total.avgOrderValue || 0),
        deliveredOrders: total.deliveredOrders,
        cancelledOrders: total.cancelledOrders,
        pendingOrders: total.pendingOrders,
        ordersThisMonth: monthly.ordersThisMonth,
        revenueThisMonth: Math.round(monthly.revenueThisMonth),
        orderGrowth,
        revenueGrowth,
        completionRate,
        recentActionNeeded: recentOrders,
      },
    });
  } catch (err) {
    console.error('getOrderStats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get seller's orders (paginated)
// @route   GET /api/orders/seller
// @access  Private/Seller
export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user!._id as mongoose.Types.ObjectId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const query: Record<string, unknown> = { seller: sellerId };
    if (status && status !== 'all') query.status = status;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('buyer', 'name email phone')
        .lean(),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getOrders error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update order status with transition validation
// @route   PATCH /api/orders/seller/:id/status
// @access  Private/Seller
export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.user!._id;
    const { id } = req.params;
    const { status, note } = req.body as { status: OrderStatus; note?: string };

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    const order = await Order.findOne({ _id: id, seller: sellerId });
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (!validTransitions[order.status].includes(status)) {
      res.status(400).json({
        success: false,
        message: `Cannot transition from ${order.status} to ${status}`,
      });
      return;
    }

    order.statusHistory.push({ status: order.status, changedAt: new Date(), note });
    order.status = status;
    await order.save();

    res.json({ success: true, data: order });
  } catch (err) {
    console.error('updateOrderStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

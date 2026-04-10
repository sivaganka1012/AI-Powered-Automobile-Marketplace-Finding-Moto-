


// ─── Admin Management Controller — Sujani ───────────────────────────────────
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import Product from '../models/Product';
import Order from '../models/Order';
import Service from '../models/Service';
import { sendApprovalEmail } from '../utils/email';

// Helper: format user for responses
const formatAdminUser = (user: any) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
  approvalStatus: user.approvalStatus,
  isActive: user.isActive,
  shopName: user.shopName,
  shopDescription: user.shopDescription,
  shopLocation: user.shopLocation,
  specialization: user.specialization,
  experienceYears: user.experienceYears,
  workshopLocation: user.workshopLocation,
  workshopName: user.workshopName,
});

// @desc    Get all pending approvals
// @route   GET /api/admin/pending
// @access  Private/Admin
export const getPendingApprovals = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const roleFilter = req.query.role as string;
    
    const filter: any = { approvalStatus: 'pending' };
    if (roleFilter && ['seller', 'mechanic'].includes(roleFilter)) {
      filter.role = roleFilter;
    } else {
      filter.role = { $in: ['seller', 'mechanic'] };
    }

    const users = await User.find(filter).sort({ createdAt: 1 });

    res.json({
      users: users.map(formatAdminUser),
      count: users.length
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Approve or reject a user
// @route   PUT /api/admin/approve/:userId
// @access  Private/Admin
export const approveUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { action, notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ message: 'Action must be "approve" or "reject"' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (!['seller', 'mechanic'].includes(user.role)) {
      res.status(400).json({ message: 'Only seller and mechanic accounts can be approved/rejected' });
      return;
    }

    if (action === 'approve') {
      user.approvalStatus = 'approved';
      user.approvalNotes = notes || 'Approved by admin';
      user.approvedAt = new Date();
    } else {
      user.approvalStatus = 'rejected';
      user.approvalNotes = notes || 'Rejected by admin';
    }

    await user.save();

    // Send approval/rejection notification email
    try {
      await sendApprovalEmail(
        user.email,
        user.firstName,
        action === 'approve',
        user.approvalNotes || undefined
      );
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
    }

    res.json({
      message: `User ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      user: formatAdminUser(user)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Get all users (admin management)
// @route   GET /api/admin/users
// @access  Private/Admin
export const getAllUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { role, status, search } = req.query;

    const filter: any = {};
    if (role) filter.role = role;
    if (status) filter.approvalStatus = status;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });

    res.json({
      users: users.map(formatAdminUser),
      count: users.length
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Get user details by ID
// @route   GET /api/admin/users/:userId
// @access  Private/Admin
export const getUserById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      user: {
        ...formatAdminUser(user),
        address: user.address,
        isEmailVerified: user.isEmailVerified,
        approvalNotes: user.approvalNotes,
        approvedAt: user.approvedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/admin/toggle-active/:userId
// @access  Private/Admin
export const toggleUserActive = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: formatAdminUser(user)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// ─── Admin Dashboard Overview ──────────────────────────────────────────────

export const getAdminOverview = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const [
      totalProducts,
      activeProducts,
      outOfStockProducts,
      totalOrders,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      activeSellers,
      revenueResult,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ status: 'out_of_stock' }),
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: { $in: ['confirmed', 'shipped'] } }),
      Order.countDocuments({ status: 'delivered' }),
      User.countDocuments({ role: 'seller', isActive: true, approvalStatus: 'approved' }),
      Order.aggregate([
        { $match: { status: { $in: ['delivered', 'confirmed', 'shipped'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const revenue = revenueResult[0]?.total ?? 0;

    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('buyer', 'firstName lastName')
      .populate('seller', 'firstName lastName shopName')
      .lean();

    // Top categories by product count
    const topCategories = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    const catTotal = topCategories.reduce((s, c) => s + c.count, 0) || 1;
    const categories = topCategories.map((c) => ({
      name: c._id || 'Other',
      value: Math.round((c.count / catTotal) * 100),
    }));

    // Monthly revenue (last 7 months)
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 6);
    sevenMonthsAgo.setDate(1);

    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          status: { $in: ['delivered', 'confirmed', 'shipped'] },
          createdAt: { $gte: sevenMonthsAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          revenue,
          totalOrders,
          pendingOrders,
          processingOrders,
          deliveredOrders,
          totalProducts,
          activeProducts,
          outOfStockProducts,
          activeSellers,
        },
        recentOrders: recentOrders.map((o: any) => ({
          _id: o._id,
          buyer: o.buyer,
          seller: o.seller,
          totalAmount: o.totalAmount,
          status: o.status,
          itemCount: o.items?.length || 0,
          createdAt: o.createdAt,
        })),
        categories,
        monthlyRevenue,
      },
    });
  } catch (err) {
    console.error('getAdminOverview error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Admin — All Products ──────────────────────────────────────────────────

export const getAdminProducts = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { search, status } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .populate('seller', 'firstName lastName shopName')
      .lean();

    res.json({ success: true, data: products, count: products.length });
  } catch (err) {
    console.error('getAdminProducts error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Admin — All Orders ────────────────────────────────────────────────────

export const getAdminOrders = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { status, search } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate('buyer', 'firstName lastName')
      .populate('seller', 'firstName lastName shopName')
      .lean();

    // If search, filter by buyer/seller name client-side (after populate)
    let result = orders;
    if (search) {
      const s = (search as string).toLowerCase();
      result = orders.filter((o: any) => {
        const buyerName = `${o.buyer?.firstName || ''} ${o.buyer?.lastName || ''}`.toLowerCase();
        const sellerName = `${o.seller?.firstName || ''} ${o.seller?.lastName || ''}`.toLowerCase();
        return buyerName.includes(s) || sellerName.includes(s) || o._id.toString().includes(s);
      });
    }

    res.json({ success: true, data: result, count: result.length });
  } catch (err) {
    console.error('getAdminOrders error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Admin — All Services ──────────────────────────────────────────────────

export const getAdminServices = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { search, active } = req.query;
    const filter: Record<string, unknown> = {};

    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const services = await Service.find(filter)
      .sort({ createdAt: -1 })
      .populate('mechanic', 'firstName lastName workshopName')
      .lean();

    res.json({ success: true, data: services, count: services.length });
  } catch (err) {
    console.error('getAdminServices error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

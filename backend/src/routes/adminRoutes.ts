// ─── Admin Routes — Sujani ──────────────────────────────────────────────────
import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getPendingApprovals,
  approveUser,
  getAllUsers,
  getUserById,
  toggleUserActive,
  getAdminOverview,
  getAdminProducts,
  getAdminOrders,
  getAdminServices,
} from '../controllers/adminController';

const router = express.Router();

// All admin routes require JWT + admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard overview
router.get('/overview', getAdminOverview);

// Products & Orders (admin-level, no seller filter)
router.get('/products', getAdminProducts);
router.get('/orders', getAdminOrders);
router.get('/services', getAdminServices);

// User management
router.get('/pending', getPendingApprovals);
router.put('/approve/:userId', approveUser);
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserById);
router.put('/toggle-active/:userId', toggleUserActive);

export default router;

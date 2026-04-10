// ─── Order Routes — Saran ───────────────────────────────────────────────────
import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  createOrder,
  getBuyerOrders,
  cancelBuyerOrder,
  getOrders,
  getOrderStats,
  updateOrderStatus,
} from '../controllers/orderController';

const router = express.Router();

// All order routes require JWT
router.use(protect);

// ─── Buyer routes ───────────────────────────────────────────────────────────
router.post('/', authorize('buyer'), createOrder);
router.get('/my', authorize('buyer'), getBuyerOrders);
router.patch('/my/:id/cancel', authorize('buyer'), cancelBuyerOrder);

// ─── Seller / Mechanic routes ───────────────────────────────────────────────
router.get('/stats', authorize('seller', 'mechanic'), getOrderStats);
router.get('/', authorize('seller', 'mechanic'), getOrders);
router.patch('/:id/status', authorize('seller', 'mechanic'), updateOrderStatus);

export default router;

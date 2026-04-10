// ─── Seller Dashboard Routes — Thulax ───────────────────────────────────────
import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getOverview,
  getAnalytics,
  getProfile,
  updateProfile,
  getSellerReviews,
} from '../controllers/sellerController';

const router = express.Router();

// All seller dashboard routes require JWT + seller role
router.use(protect);
router.use(authorize('seller'));

// Overview & analytics
router.get('/overview', getOverview);
router.get('/analytics', getAnalytics);

// Reviews
router.get('/reviews', getSellerReviews);

// Profile
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

export default router;

import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getProfile,
  updateProfile,
  getOverview,
  getMechanicReviews,
  getServices,
  createService,
  updateService,
  deleteService,
} from '../controllers/mechanicController';

const router = express.Router();

// All mechanic routes require JWT + mechanic role
router.use(protect);
router.use(authorize('mechanic'));

// Overview
router.get('/overview', getOverview);
router.get('/reviews', getMechanicReviews);

// Profile
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Services CRUD
router.get('/services', getServices);
router.post('/services', createService);
router.put('/services/:id', updateService);
router.delete('/services/:id', deleteService);

export default router;

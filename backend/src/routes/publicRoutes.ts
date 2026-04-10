// ─── Public Routes — No authentication required ────────────────────────────
import express from 'express';
import {
  getPublicProducts,
  getPublicProduct,
  getTrendingProducts,
  getPublicMechanics,
  getPublicMechanicProfile,
  getPublicSellerProfile,
  getPublicMechanicServices,
  getPublicAllServices,
} from '../controllers/publicController';

const router = express.Router();

// Products (public browsing)
router.get('/products/trending', getTrendingProducts);
router.get('/products/:id', getPublicProduct);
router.get('/products', getPublicProducts);

// Mechanics / Garages (public listing)
router.get('/mechanics', getPublicMechanics);
router.get('/sellers/:id', getPublicSellerProfile);

// Mechanic services (public)
router.get('/mechanics/:id/services', getPublicMechanicServices);
router.get('/mechanics/:id', getPublicMechanicProfile);
router.get('/services', getPublicAllServices);

export default router;

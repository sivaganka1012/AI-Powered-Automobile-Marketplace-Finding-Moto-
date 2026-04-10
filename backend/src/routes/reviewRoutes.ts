import { Router } from 'express';
import { addReview, getReviews, getMyReviews, deleteReview, addSellerReview, addMechanicReview, getSellerReviews, getMechanicReviews } from '../controllers/reviewController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

// Specific routes (must be before generic :productId route)
// My reviews (buyer)
router.get('/my', protect, authorize('buyer'), getMyReviews);

// Seller reviews
router.get('/seller/:sellerId', getSellerReviews);
router.post('/seller/:sellerId', protect, authorize('buyer'), addSellerReview);

// Mechanic reviews
router.get('/mechanic/:mechanicId', getMechanicReviews);
router.post('/mechanic/:mechanicId', protect, authorize('buyer'), addMechanicReview);

// Delete review
router.delete('/delete/:id', protect, deleteReview);

// Product reviews (generic route - should be last)
router.post('/:productId', protect, authorize('buyer'), addReview);
router.get('/:productId', getReviews);

export default router;

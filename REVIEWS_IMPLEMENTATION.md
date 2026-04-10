# Buyer Reviews for Sellers and Mechanics - Implementation Guide

## Overview
This document describes the implementation of a feature that allows buyers to add star ratings and text reviews to sellers and mechanics. This complements the existing product review system.

## Backend Implementation

### 1. Database Model Updates (`backend/src/models/Review.ts`)

The Review schema has been extended to support three types of reviews:
- **Product reviews** (existing): `productId` field
- **Seller reviews** (new): `sellerId` field
- **Mechanic reviews** (new): `mechanicId` field

**Schema Fields:**
```typescript
{
  productId?: ObjectId,      // Optional, for product reviews
  sellerId?: ObjectId,       // Optional, for seller reviews
  mechanicId?: ObjectId,     // Optional, for mechanic reviews
  buyer: ObjectId,           // Required, always populated
  rating: Number,            // 1-5 scale
  comment: String,           // Text review
  createdAt: Date,
  updatedAt: Date
}
```

**Unique Constraints:**
- One review per buyer per product (if productId exists)
- One review per buyer per seller (if sellerId exists)
- One review per buyer per mechanic (if mechanicId exists)

### 2. API Controller Updates (`backend/src/controllers/reviewController.ts`)

#### New Functions Added:

**`addSellerReview(req: AuthRequest, res: Response)`**
- **Route:** `POST /api/reviews/seller/:sellerId`
- **Auth:** Required (buyer only)
- **Request Body:** `{ rating: 1-5, comment: "text" }`
- **Validation:**
  - Seller exists
  - Buyer has a delivered order from the seller
  - Rating is 1-5
  - Comment is not empty
- **Response:** Created review object or updated existing review

**`addMechanicReview(req: AuthRequest, res: Response)`**
- **Route:** `POST /api/reviews/mechanic/:mechanicId`
- **Auth:** Required (buyer only)
- **Request Body:** `{ rating: 1-5, comment: "text" }`
- **Validation:**
  - Mechanic exists
  - Buyer has a delivered order from the mechanic
  - Rating is 1-5
  - Comment is not empty
- **Response:** Created review object or updated existing review

**`getSellerReviews(req: Request, res: Response)`**
- **Route:** `GET /api/reviews/seller/:sellerId`
- **Auth:** Not required (public)
- **Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "average": 4.5,
      "total": 10,
      "recommended": 80
    },
    "distribution": [
      { "stars": 5, "count": 6, "percentage": 60 },
      { "stars": 4, "count": 2, "percentage": 20 },
      ...
    ],
    "reviews": [
      {
        "_id": "...",
        "sellerId": "...",
        "buyer": {
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "..."
        },
        "rating": 5,
        "comment": "Great seller!",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

**`getMechanicReviews(req: Request, res: Response)`**
- **Route:** `GET /api/reviews/mechanic/:mechanicId`
- **Auth:** Not required (public)
- **Response:** Same format as seller reviews

### 3. Routes Update (`backend/src/routes/reviewRoutes.ts`)

```typescript
// Specific routes (must be before generic routes)
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
```

## Frontend Implementation

### 1. Service Updates (`frontend/src/services/reviewService.ts`)

New TypeScript interfaces and functions added:

```typescript
// Get reviews for a specific seller
getSellerReviews(sellerId: string): Promise<ReviewResponse>

// Add a review to a seller
addSellerReview(sellerId: string, reviewData: ReviewData): Promise<Review>

// Get reviews for a specific mechanic
getMechanicReviews(mechanicId: string): Promise<ReviewResponse>

// Add a review to a mechanic
addMechanicReview(mechanicId: string, reviewData: ReviewData): Promise<Review>
```

### 2. New Component (`frontend/src/components/SellerMechanicReview.tsx`)

A reusable React component for displaying and adding reviews to sellers/mechanics.

**Props:**
```typescript
{
  targetId: string;          // ID of the seller or mechanic
  targetType: 'seller' | 'mechanic';
}
```

**Features:**
- Interactive star rating selector (1-5 stars with hover preview)
- Text comment input with character count
- Review submission with loading state
- Error and success notifications
- Display of review statistics (average, total, recommended percentage)
- Rating distribution chart
- List of all reviews with buyer info and timestamps
- Responsive design

**Usage Example:**
```jsx
import SellerMechanicReview from '@/components/SellerMechanicReview';

function SellerProfilePage({ sellerId }) {
  return (
    <div>
      <h1>Seller Profile</h1>
      <SellerMechanicReview 
        targetId={sellerId} 
        targetType="seller" 
      />
    </div>
  );
}
```

## Business Logic

### Review Eligibility
- Buyers can only review sellers/mechanics they have purchased from
- Must have at least one **delivered** order to leave a review
- Only one review per buyer per seller/mechanic (subsequent submissions update the existing review)

### Review Submissions
- Rating: Required, must be between 1 and 5
- Comment: Required, must be non-empty text
- Timestamps are automatically recorded

### Review Visibility
- All reviews are public (no authentication required to view)
- Reviews include buyer name, avatar, rating, comment, and timestamp
- Statistics calculated on-the-fly based on available reviews

## Error Handling

**Common Error Responses:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | Invalid seller/mechanic ID | Malformed ObjectId |
| 400 | Rating (1-5) and comment are required | Missing or invalid input |
| 403 | You can only review sellers you have purchased from | No delivered order found |
| 404 | Seller/Mechanic not found | ID doesn't exist |
| 401 | Unauthorized | Not authenticated or not a buyer |
| 500 | Error adding/fetching review | Server error |

## Testing the Feature

### Adding a Seller Review (curl example):
```bash
curl -X POST http://localhost:5000/api/reviews/seller/seller_id_here \
  -H "Authorization: Bearer buyer_token" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "Excellent service and fast delivery!"
  }'
```

### Getting Seller Reviews:
```bash
curl http://localhost:5000/api/reviews/seller/seller_id_here
```

### Adding a Mechanic Review (curl example):
```bash
curl -X POST http://localhost:5000/api/reviews/mechanic/mechanic_id_here \
  -H "Authorization: Bearer buyer_token" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "Great work, highly recommend!"
  }'
```

### Getting Mechanic Reviews:
```bash
curl http://localhost:5000/api/reviews/mechanic/mechanic_id_here
```

## Integration Points

To fully integrate this feature into the application:

1. **Seller Profile Pages** - Add `<SellerMechanicReview>` component to show seller reviews
2. **Mechanic Profile Pages** - Add `<SellerMechanicReview>` component to show mechanic reviews
3. **Order Success Page** - Show prompt to review seller/mechanic after order delivery
4. **Seller Dashboard** - Update `/seller/reviews` page to show both product reviews AND direct seller reviews
5. **Mechanic Dashboard** - Update `/mechanic/reviews` page to show both service reviews AND direct mechanic reviews

## Files Modified

- `backend/src/models/Review.ts` - Extended schema
- `backend/src/controllers/reviewController.ts` - Added 4 new functions
- `backend/src/routes/reviewRoutes.ts` - Added 4 new routes
- `frontend/src/services/reviewService.ts` - Added 4 new functions
- `frontend/src/components/SellerMechanicReview.tsx` - New component (created)

## Notes

- No database migration required (schema is backward compatible)
- All existing product review functionality remains unchanged
- The component is fully self-contained and handles all UI/UX concerns
- All responses follow the existing API response pattern
- Timestamps are automatically managed by MongoDB

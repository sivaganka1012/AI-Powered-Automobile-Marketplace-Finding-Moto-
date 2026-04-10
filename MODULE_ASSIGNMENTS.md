# AI Powered Automobile Marketplace — Module Assignments

> **Project:** Finding Moto  
> **Team Size:** 6 Members  
> **Date:** March 2026

---

## Common / Shared Files (Used by ALL Members)

These files form the base of the project. Every member depends on them.

### Root

| File | Purpose |
|------|---------|
| `.gitignore` | Git ignore rules |
| `README.md` | Project overview |
| `DASHBOARD_ANALYSIS.md` | Dashboard analysis doc |

### Backend — Core

| File | Purpose |
|------|---------|
| `backend/package.json` | Backend dependencies |
| `backend/tsconfig.json` | TypeScript config |
| `backend/.gitignore` | Backend git ignore |
| `backend/.env.example` | Environment variable template |
| `backend/README.md` | Backend documentation |
| `backend/app.ts` | Express app setup, CORS, route registration |
| `backend/server.ts` | Server bootstrap, MongoDB connect |
| `backend/config/index.ts` | Env var loader (JWT, SMTP, Google, Mongo) |
| `backend/utils/db.ts` | MongoDB/Mongoose connection |
| `backend/middleware/auth.ts` | JWT `protect` + `authorize(roles)` guards |
| `backend/middleware/errorHandler.ts` | Global error handler |

### Frontend — Config

| File | Purpose |
|------|---------|
| `frontend/package.json` | Frontend dependencies |
| `frontend/tsconfig.json` | TypeScript config |
| `frontend/tsconfig.node.json` | TS config (node context) |
| `frontend/vite.config.ts` | Vite build config |
| `frontend/index.html` | HTML entry point |
| `frontend/README.md` | Frontend documentation |

### Frontend — App Shell & Styles

| File | Purpose |
|------|---------|
| `frontend/src/main.tsx` | React entry point |
| `frontend/src/App.tsx` | All routes & role guards |
| `frontend/src/App.css` | App-level styles |
| `frontend/src/index.css` | Global styles |
| `frontend/src/vite-env.d.ts` | Vite type declarations |
| `frontend/src/styles/index.css` | Additional global styles |

### Frontend — Context / Services / Hooks / Lib

| File | Purpose |
|------|---------|
| `frontend/src/context/AuthContext.tsx` | Auth state management |
| `frontend/src/services/api.ts` | Axios instance with JWT interceptor |
| `frontend/src/lib/utils.ts` | `cn()` class merge utility |
| `frontend/src/hooks/use-mobile.tsx` | Responsive breakpoint hook |
| `frontend/src/hooks/use-toast.ts` | Toast notification hook |

### Frontend — Shared Components

| File | Purpose |
|------|---------|
| `frontend/src/components/NavLink.tsx` | Navigation link helper |
| `frontend/src/components/ThemeProvider.tsx` | Dark/light mode provider |
| `frontend/src/components/ThemeToggle.tsx` | Theme toggle button |

### Frontend — Layout (Header & Footer)

| File | Purpose |
|------|---------|
| `frontend/src/components/layout/Header.tsx` | Site header & navigation |
| `frontend/src/components/layout/Footer.tsx` | Site footer |

### Frontend — Home Page Sections

| File | Purpose |
|------|---------|
| `frontend/src/components/home/HeroSection.tsx` | Hero section with animated motorcycle |
| `frontend/src/components/home/CategoriesSection.tsx` | Category grid |
| `frontend/src/components/home/TrendingProducts.tsx` | Trending products carousel |
| `frontend/src/components/home/ServicesSection.tsx` | Featured garages section |
| `frontend/src/components/home/FeaturesSection.tsx` | Trust badges |
| `frontend/src/components/home/CTASection.tsx` | Call-to-action section |

### Frontend — Public Pages

| File | Purpose |
|------|---------|
| `frontend/src/pages/Home.tsx` | Landing page |
| `frontend/src/pages/About.tsx` | About page |
| `frontend/src/pages/Contact.tsx` | Contact page |
| `frontend/src/pages/Services.tsx` | Find-a-garage page |
| `frontend/src/pages/Index.tsx` | Redirect to `/` |
| `frontend/src/pages/NotFound.tsx` | 404 page |

### Frontend — UI Component Library (49 shadcn/ui files)

All files inside `frontend/src/components/ui/`:

`accordion.tsx`, `alert.tsx`, `alert-dialog.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `badge.tsx`, `breadcrumb.tsx`, `button.tsx`, `calendar.tsx`, `card.tsx`, `carousel.tsx`, `chart.tsx`, `checkbox.tsx`, `collapsible.tsx`, `command.tsx`, `context-menu.tsx`, `dialog.tsx`, `drawer.tsx`, `dropdown-menu.tsx`, `form.tsx`, `hover-card.tsx`, `input.tsx`, `input-otp.tsx`, `label.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`, `skeleton.tsx`, `slider.tsx`, `sonner.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `toast.tsx`, `toaster.tsx`, `toggle.tsx`, `toggle-group.tsx`, `tooltip.tsx`, `use-toast.ts`

### Frontend — Static Assets

| File | Purpose |
|------|---------|
| `frontend/public/images/login/` | Login page carousel images |
| `frontend/src/assets/.gitkeep` | Assets placeholder |
| `frontend/src/test/setup.ts` | Test setup |
| `frontend/src/test/example.test.ts` | Sample test |

---

## NOT Pushed to GitHub

| Item | Reason |
|------|--------|
| `node_modules/` | Auto-installed via `npm install` |
| `dist/` / `build/` | Generated at build time |
| `.env` | Contains secrets (only `.env.example` is pushed) |
| `uploads/products/*.jpg` | User-uploaded content |

---

---

## Module 1: User Management — Raakul

**Scope:** Registration, login, OTP email verification, Google OAuth, profile management, password change, email service.

### Backend Files

| File | Purpose |
|------|--------|
| `backend/models/User.ts` | User schema — roles, approval, OTP, bcrypt, seller/mechanic fields |
| `backend/controllers/authController.ts` | register, login, googleAuth, verifyOTP, resendOTP, getMe, updateProfile, changePassword, checkApprovalStatus |
| `backend/routes/authRoutes.ts` | `/api/auth/*` — public + protected auth endpoints |
| `backend/utils/email.ts` | OTP emails, welcome emails, approval notification emails (485 lines) |
| `backend/scripts/seedAdmin.ts` | Seed admin user (admin@findingmoto.com) |
| `backend/scripts/seedUsers.ts` | Seed sample sellers & mechanics |

### Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/context/AuthContext.tsx` | Auth state — login, register, logout, OTP, Google auth methods |
| `frontend/src/services/api.ts` | Axios instance with Bearer token interceptor |
| `frontend/src/pages/Login.tsx` | Login form + Google OAuth + OTP verification flow (397 lines) |
| `frontend/src/pages/Register.tsx` | Multi-step registration — role selection, role-specific fields (714 lines) |
| `frontend/src/pages/ChangePassword.tsx` | Current/new/confirm password form (256 lines) |
| `frontend/src/pages/Dashboard.tsx` | Buyer/role-aware dashboard with quick actions (297 lines) |

### Total: 12 files

---

## Module 2: Product Management — Arun

**Scope:** Product CRUD (create, read, update, delete), image upload, product catalog browsing, categories, search & filtering, inventory management.

### Backend Files

| File | Purpose |
|------|---------|
| `backend/models/Product.ts` | Product schema — seller ref, images, category, brand, price, stock, status |
| `backend/controllers/productController.ts` | `getProducts`, `createProduct`, `updateProduct`, `deleteProduct` functions |
| `backend/routes/productRoutes.ts` | `/api/products/*` — Product CRUD endpoints + Multer image upload config |

### Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/pages/Products.tsx` | Public product catalog — search, filters, grid/list view (321 lines) |
| `frontend/src/pages/seller/Products.tsx` | Seller product CRUD — add/edit modal, delete confirm (473 lines) |
| `frontend/src/pages/mechanic/Products.tsx` | Mechanic parts inventory management (473 lines) |
| `frontend/src/pages/admin/ProductsManagement.tsx` | Admin products overview table (103 lines) |
| `frontend/src/components/home/TrendingProducts.tsx` | Homepage trending products carousel |
| `frontend/src/components/home/CategoriesSection.tsx` | Homepage category grid with icons |

### Total: 9 files

---

## Module 3: Order Management — Saran

**Scope:** Order creation, status workflow (pending → confirmed → shipped → delivered → cancelled), order tracking, payment info, order history.

### Backend Files

| File | Purpose |
|------|---------|
| `backend/models/Order.ts` | Order schema — buyer/seller refs, items, status, shipping, payment, statusHistory |
| `backend/controllers/orderController.ts` | `getOrders`, `updateOrderStatus` functions (validates state transitions) |
| `backend/routes/orderRoutes.ts` | `/api/orders/*` — GET orders, PATCH `/:id/status` endpoints |

### Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/pages/seller/Orders.tsx` | Seller order management — list, detail modal, status transitions (312 lines) |
| `frontend/src/pages/mechanic/Orders.tsx` | Mechanic service requests — Accept/Start/Complete workflow (314 lines) |
| `frontend/src/pages/admin/OrdersManagement.tsx` | Admin orders overview table with filters (111 lines) |

### Total: 6 files

---

## Module 4: Seller Dashboard — Thulax

**Scope:** Seller & mechanic panel layouts, overview analytics, profile management, AI chat assistant, notifications, navigation.

### Backend Files

| File | Purpose |
|------|---------|
| `backend/controllers/sellerController.ts` | `getOverview`, `getAnalytics`, `getProfile`, `updateProfile` functions (seller dashboard only) |
| `backend/controllers/mechanicController.ts` | `getProfile`, `updateProfile`, `getOverview` functions |
| `backend/routes/sellerRoutes.ts` | `/api/seller/*` — `/overview`, `/analytics`, `/profile` endpoints (dashboard only) |
| `backend/routes/mechanicRoutes.ts` | Mechanic `/overview`, `/profile` endpoints |

### Frontend Files — Seller

| File | Purpose |
|------|---------|
| `frontend/src/components/SellerLayout.tsx` | Seller sidebar + topbar layout shell (271 lines) |
| `frontend/src/pages/seller/Dashboard.tsx` | Seller overview — revenue, orders, products stats (542 lines, live API) |
| `frontend/src/pages/seller/Profile.tsx` | Shop profile editing (291 lines) |
| `frontend/src/pages/seller/AIChat.tsx` | AI sales assistant chat (425 lines) |
| `frontend/src/pages/seller/Notifications.tsx` | Seller notification center (250 lines) |

### Frontend Files — Mechanic

| File | Purpose |
|------|---------|
| `frontend/src/components/MechanicLayout.tsx` | Mechanic sidebar + topbar layout shell (271 lines) |
| `frontend/src/pages/mechanic/Dashboard.tsx` | Mechanic overview — service stats, weekly chart (242 lines) |
| `frontend/src/pages/mechanic/Profile.tsx` | Workshop profile editing (318 lines) |
| `frontend/src/pages/mechanic/AIChat.tsx` | AI diagnostic assistant chat (468 lines) |
| `frontend/src/pages/mechanic/Notifications.tsx` | Mechanic notification center (242 lines) |

### Total: 14 files

---

## Module 5: Admin Dashboard — Sujani

**Scope:** Admin panel layout, platform-level management (users, contacts, settings), system notifications, user approval/rejection.

### Backend Files

| File | Purpose |
|------|---------|
| `backend/controllers/adminController.ts` | `getPendingApprovals`, `approveUser`, `getAllUsers`, `getUserById`, `toggleUserActive` functions |
| `backend/routes/adminRoutes.ts` | `/api/admin/*` — `/pending`, `/approve/:userId`, `/users`, `/users/:userId`, `/toggle-active/:userId` |

### Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/components/AdminLayout.tsx` | Admin sidebar layout shell (156 lines) |
| `frontend/src/pages/admin/Dashboard.tsx` | Admin KPIs — revenue, orders, shops, products (195 lines) |
| `frontend/src/pages/admin/UsersManagement.tsx` | User approval & management (766 lines, live API) |
| `frontend/src/pages/admin/Notifications.tsx` | Admin notification list (64 lines) |
| `frontend/src/pages/admin/ContactManagement.tsx` | Contact message management (92 lines) |
| `frontend/src/pages/admin/SettingsPage.tsx` | Platform settings (99 lines) |
| `frontend/src/pages/admin/NotFound.tsx` | Admin 404 page (26 lines) |

### Total: 9 files

---

## Module 6: Rating & Review — Sivaganga

**Scope:** Product & service ratings (1–5 stars), customer reviews, review submission, rating distribution display.

### Backend Files

| File | Purpose |
|------|---------|
| `backend/models/Review.js` | Review schema — productId, rating (1-5), comment |
| `backend/controllers/reviewController.js` | `addReview`, `getReviews`, `deleteReview` functions |
| `backend/routes/reviewRoutes.js` | POST/GET `/:productId`, DELETE `/delete/:id` |

### Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/services/reviewService.js` | API calls — `getReviews()`, `addReview()` |
| `frontend/src/components/RatingReview.jsx` | Standalone review widget — submit form + display (102 lines) |
| `frontend/src/pages/seller/Reviews.tsx` | Seller reviews dashboard — rating chart, review list (186 lines) |
| `frontend/src/pages/mechanic/Reviews.tsx` | Mechanic service reviews — rating breakdown, review list (253 lines) |

### Total: 7 files

---


## Summary Table

| Module | Member | Module Files | Common Files | Total |
|--------|--------|-------------|--------------|-------|
| User Management | Raakul | 12 | ~102 | ~114 |
| Product Management | Arun | 9 | ~102 | ~111 |
| Order Management | Saran | 6 | ~102 | ~108 |
| Seller Dashboard | Thulax | 14 | ~102 | ~116 |
| Admin Dashboard | Sujani | 9 | ~102 | ~111 |
| Rating & Review | Sivaganga | 7 | ~102 | ~109 |

// ─── Auth Routes — Raakul ───────────────────────────────────────────────────
import express, { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import {
  register,
  login,
  googleAuth,
  verifyOTP,
  resendOTP,
  getMe,
  updateProfile,
  uploadAvatar,
  changePassword,
  checkApprovalStatus,
  addRole,
  getMyRoles,
} from '../controllers/authController';
import { protect } from '../middleware/auth';

const router: Router = express.Router();

const avatarUploadsDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
if (!fs.existsSync(avatarUploadsDir)) {
  fs.mkdirSync(avatarUploadsDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarUploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  },
});

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.get('/approval-status', checkApprovalStatus);

// Protected routes (any authenticated user)
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/upload-avatar', protect, avatarUpload.single('image'), uploadAvatar);
router.put('/change-password', protect, changePassword);
router.post('/add-role', protect, addRole);
router.get('/my-roles', protect, getMyRoles);

export default router;

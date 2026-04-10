import { Response } from 'express';
import mongoose from 'mongoose';
import User, { IUser, UserRole } from '../models/User';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import dns from 'dns';
import { promisify } from 'util';
import config from '../config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { AuthRequest } from '../middleware/auth';
import { generateOTP, sendOTPEmail, sendWelcomeEmail } from '../utils/email';

const resolveMx = promisify(dns.resolveMx);

interface EmailValidationResult {
  valid: boolean;
  reason?: string;
}

interface RegisterRequestBody {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role: UserRole;
  // Seller fields
  shopName?: string;
  shopDescription?: string;
  shopLocation?: string;
  sellerSpecializations?: string[];
  sellerBrands?: string[];
  // Mechanic fields
  specialization?: string;
  experienceYears?: number;
  workshopLocation?: string;
  workshopName?: string;
}

interface LoginRequestBody {
  email: string;
  password: string;
  role?: UserRole;
}

interface GoogleAuthRequestBody {
  credential: string;
}

interface UserResponse {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  avatar?: string | null;
  role: UserRole;
  approvalStatus: string;
  isActive: boolean;
  shopName?: string;
  shopDescription?: string;
  shopLocation?: string;
  sellerSpecializations?: string[];
  sellerBrands?: string[];
  specialization?: string;
  experienceYears?: number;
  workshopLocation?: string;
  workshopName?: string;
}

interface AuthResponse {
  user: UserResponse;
  token: string;
}

// Validate email format and domain MX records
const validateEmail = async (email: string): Promise<EmailValidationResult> => {
  // Strict format check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  // Check domain has MX records (can actually receive email)
  // If DNS is unavailable, allow the email through (soft check)
  const domain = email.split('@')[1];
  try {
    const mxRecords = await resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: 'Email domain cannot receive emails' };
    }
  } catch (err: any) {
    // Only reject if domain definitively doesn't exist (ENOTFOUND)
    // Allow through on network errors (ECONNREFUSED, ETIMEOUT, etc.)
    if (err?.code === 'ENOTFOUND') {
      return { valid: false, reason: 'Email domain does not exist' };
    }
    // DNS unavailable — skip MX check, allow registration
    console.warn(`DNS MX lookup skipped for ${domain}: ${err?.code || err?.message}`);
  }

  return { valid: true };
};

const googleClient = new OAuth2Client(config.googleClientId);

// Generate JWT Token
const generateToken = (id: mongoose.Types.ObjectId, role: string): string => {
  const secret: Secret = config.jwtSecret;
  const options: SignOptions = { expiresIn: config.jwtExpiresIn as any };
  return jwt.sign({ id: id.toString(), role }, secret, options);
};

// Format user response
const formatUser = (user: IUser): UserResponse => ({
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
  sellerSpecializations: user.sellerSpecializations || [],
  sellerBrands: user.sellerBrands || [],
  specialization: user.specialization,
  experienceYears: user.experienceYears,
  workshopLocation: user.workshopLocation,
  workshopName: user.workshopName
});

// @desc    Register new user (buyer, seller, or mechanic)
// @route   POST /api/auth/register
// @access  Public
export const register = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      firstName, lastName, email, password, phone, role,
      shopName, shopDescription, shopLocation,
      specialization, experienceYears, workshopLocation, workshopName
    } = req.body as RegisterRequestBody;

    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ message: 'Please fill in all required fields' });
      return;
    }

    // Validate role
    const validRoles: UserRole[] = ['buyer', 'seller', 'mechanic'];
    const userRole = role || 'buyer';
    if (!validRoles.includes(userRole)) {
      res.status(400).json({ message: 'Invalid role. Must be buyer, seller, or mechanic' });
      return;
    }

    // Validate role-specific required fields
    if (userRole === 'seller' && !shopName) {
      res.status(400).json({ message: 'Shop name is required for sellers' });
      return;
    }
    if (userRole === 'mechanic' && !specialization) {
      res.status(400).json({ message: 'Specialization is required for mechanics' });
      return;
    }

    // Validate email format and domain
    const emailCheck = await validateEmail(email);
    if (!emailCheck.valid) {
      res.status(400).json({ message: emailCheck.reason });
      return;
    }

    // Check if user already exists with same email AND role
    const userExists = await User.findOne({ email, role: userRole });
    if (userExists) {
      res.status(400).json({ message: `An account with this email already exists as ${userRole}` });
      return;
    }

    // Build user data
    const userData: any = {
      firstName, lastName, email, password, phone, role: userRole
    };

    // Add seller-specific fields
    if (userRole === 'seller') {
      userData.shopName = shopName;
      userData.shopDescription = shopDescription;
      userData.shopLocation = shopLocation;
    }

    // Add mechanic-specific fields
    if (userRole === 'mechanic') {
      userData.specialization = specialization;
      userData.experienceYears = experienceYears;
      userData.workshopLocation = workshopLocation;
      userData.workshopName = workshopName;
    }

    // Create user
    const user = await User.create(userData);

    // Generate and save OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.isEmailVerified = false;
    await user.save();

    // Send OTP email
    try {
      await sendOTPEmail(email, otp, firstName);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      // Don't fail registration, user can resend OTP
    }

    // Return response - no token until email is verified
    res.status(201).json({
      message: 'Registration successful! Please check your email for the verification code.',
      requiresVerification: true,
      email: user.email,
      role: user.role
    });
  } catch (error: any) {
    // Handle MongoDB duplicate key error (race condition on rapid clicks)
    if (error?.code === 11000) {
      res.status(400).json({ message: `An account with this email already exists as ${req.body?.role || 'this role'}` });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Registration error:', errorMessage);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, password, role } = req.body as LoginRequestBody;

    if (!email || !password) {
      res.status(400).json({ message: 'Please provide email and password' });
      return;
    }

    // If role is specified (user chose from role selection), find that specific account
    if (role) {
      const user = await User.findOne({ email, role }).select('+password');
      if (!user || !user.password) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
      }
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
      }
      if (!user.isActive) {
        res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
        return;
      }
      if (!user.isEmailVerified && user.role !== 'admin') {
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await User.updateOne({ _id: user._id }, { $set: { otp, otpExpires } });
        try { await sendOTPEmail(user.email, otp, user.firstName || 'User'); } catch {}
        res.status(403).json({
          message: 'Email not verified. A new verification code has been sent to your email.',
          requiresVerification: true, email: user.email, role: user.role
        });
        return;
      }
      if (!user.canLogin()) {
        res.status(403).json({ message: user.getApprovalMessage(), approvalStatus: user.approvalStatus, role: user.role });
        return;
      }
      res.json({ user: formatUser(user), token: generateToken(user._id, user.role) });
      return;
    }

    // Check for user — same email may have multiple role accounts
    const users = await User.find({ email }).select('+password');
    if (!users || users.length === 0) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    // Try password against each account to find matching roles
    const matchedUsers: IUser[] = [];
    for (const candidate of users) {
      if (!candidate.password) continue;
      const isMatch = await candidate.matchPassword(password);
      if (isMatch) {
        matchedUsers.push(candidate);
      }
    }

    if (matchedUsers.length === 0) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    // If multiple roles matched the same password, ask user to choose
    if (matchedUsers.length > 1) {
      const roles = matchedUsers.map(u => ({
        role: u.role,
        approvalStatus: u.approvalStatus,
        isActive: u.isActive,
        isEmailVerified: u.isEmailVerified
      }));
      res.json({
        requiresRoleSelection: true,
        email,
        roles
      });
      return;
    }

    const user = matchedUsers[0];

    // Check if account is active
    if (!user.isActive) {
      res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
      return;
    }

    // Check if email is verified (skip for admin users — they are created via seed/DB)
    if (!user.isEmailVerified && user.role !== 'admin') {
      // Resend OTP automatically
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      // Use updateOne to avoid Mongoose validation on potentially incomplete legacy documents
      await User.updateOne({ _id: user._id }, { $set: { otp, otpExpires } });
      try {
        await sendOTPEmail(user.email, otp, user.firstName || 'User');
      } catch (emailError) {
        console.error('Failed to resend OTP:', emailError);
      }
      res.status(403).json({
        message: 'Email not verified. A new verification code has been sent to your email.',
        requiresVerification: true,
        email: user.email,
        role: user.role
      });
      return;
    }

    // Check if user can login (approval check for sellers/mechanics)
    if (!user.canLogin()) {
      res.status(403).json({
        message: user.getApprovalMessage(),
        approvalStatus: user.approvalStatus,
        role: user.role
      });
      return;
    }

    res.json({
      user: formatUser(user),
      token: generateToken(user._id, user.role)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Google Authentication (buyers only)
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { credential } = req.body as GoogleAuthRequestBody;

    if (!credential) {
      res.status(400).json({ message: 'Google credential is required' });
      return;
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId
    });

    const payload = ticket.getPayload() as TokenPayload;
    const { sub: googleId, email, given_name, family_name, picture } = payload;

    if (!email) {
      res.status(400).json({ message: 'Email not provided by Google' });
      return;
    }

    // Check if user exists (Google auth = buyer only)
    let user = await User.findOne({ $or: [{ googleId }, { email, role: 'buyer' }] });

    if (user) {
      // Update Google ID and avatar if not set
      const updateFields: any = {};
      if (!user.googleId) updateFields.googleId = googleId;
      if (picture && !user.avatar) updateFields.avatar = picture;
      if (Object.keys(updateFields).length > 0) {
        await User.updateOne({ _id: user._id }, { $set: updateFields });
        if (updateFields.googleId) user.googleId = googleId;
        if (updateFields.avatar) user.avatar = picture || null;
      }

      // Check if user can login
      if (!user.canLogin()) {
        res.status(403).json({
          message: user.getApprovalMessage(),
          approvalStatus: user.approvalStatus,
          role: user.role
        });
        return;
      }
    } else {
      // Create new user as buyer (Google OAuth = buyer only)
      user = await User.create({
        firstName: given_name || 'User',
        lastName: family_name || '',
        email,
        googleId,
        avatar: picture,
        role: 'buyer'
      });
    }

    res.json({
      user: formatUser(user),
      token: generateToken(user._id, user.role)
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Google authentication failed' });
  }
};

// @desc    Verify OTP for email verification
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, otp, role } = req.body;

    if (!email || !otp) {
      res.status(400).json({ message: 'Email and OTP are required' });
      return;
    }

    // Find the unverified user with this email (and optional role)
    const filter: any = { email, isEmailVerified: false };
    if (role) filter.role = role;
    const user = await User.findOne(filter).sort({ createdAt: -1 });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({ message: 'Email is already verified' });
      return;
    }

    // Check OTP
    if (!user.otp || user.otp !== otp) {
      res.status(400).json({ message: 'Invalid verification code' });
      return;
    }

    // Check OTP expiration
    if (!user.otpExpires || user.otpExpires < new Date()) {
      res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
      return;
    }

    // Mark email as verified and clear OTP
    // Use updateOne to avoid Mongoose validation on potentially incomplete legacy documents
    await User.updateOne(
      { _id: user._id },
      { $set: { isEmailVerified: true, otp: null, otpExpires: null } }
    );
    user.isEmailVerified = true;
    user.otp = null;
    user.otpExpires = null;

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.firstName, user.role);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // If buyer (auto-approved), return token
    // If seller/mechanic (needs approval), return message
    const responseData: any = {
      message: user.getApprovalMessage(),
      user: formatUser(user),
      verified: true
    };

    if (user.canLogin()) {
      responseData.token = generateToken(user._id, user.role);
    }

    res.json(responseData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Resend OTP verification code
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, role } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    // Find the unverified user with this email (and optional role)
    const filter: any = { email, isEmailVerified: false };
    if (role) filter.role = role;
    const user = await User.findOne(filter).sort({ createdAt: -1 });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({ message: 'Email is already verified' });
      return;
    }

    // Rate limiting: don't allow resend if OTP was sent less than 60 seconds ago
    if (user.otpExpires) {
      const otpCreatedAt = new Date(user.otpExpires.getTime() - 10 * 60 * 1000);
      const timeSince = Date.now() - otpCreatedAt.getTime();
      if (timeSince < 60 * 1000) {
        const waitSeconds = Math.ceil((60 * 1000 - timeSince) / 1000);
        res.status(429).json({ message: `Please wait ${waitSeconds} seconds before requesting a new code.` });
        return;
      }
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    // Use updateOne to avoid Mongoose validation on potentially incomplete legacy documents
    await User.updateOne({ _id: user._id }, { $set: { otp, otpExpires } });

    // Send OTP email
    await sendOTPEmail(user.email, otp, user.firstName || 'User');

    res.json({ message: 'A new verification code has been sent to your email.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json(formatUser(user));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Fields that can be updated by the user
    const { firstName, lastName, phone, address, avatar } = req.body;
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (avatar !== undefined) user.avatar = avatar;

    // Role-specific fields
    if (user.role === 'seller') {
      const { shopName, shopDescription, shopLocation, sellerSpecializations, sellerBrands } = req.body;
      if (shopName) user.shopName = shopName;
      if (shopDescription !== undefined) user.shopDescription = shopDescription;
      if (shopLocation !== undefined) user.shopLocation = shopLocation;
      if (sellerSpecializations !== undefined) user.sellerSpecializations = Array.isArray(sellerSpecializations) ? sellerSpecializations : [];
      if (sellerBrands !== undefined) user.sellerBrands = Array.isArray(sellerBrands) ? sellerBrands : [];
    }

    if (user.role === 'mechanic') {
      const { specialization, experienceYears, workshopLocation, workshopName } = req.body;
      if (specialization) user.specialization = specialization;
      if (experienceYears !== undefined) user.experienceYears = experienceYears;
      if (workshopLocation !== undefined) user.workshopLocation = workshopLocation;
      if (workshopName !== undefined) user.workshopName = workshopName;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: formatUser(user)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Upload avatar image
// @route   POST /api/auth/upload-avatar
// @access  Private
export const uploadAvatar = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'No image file provided' });
      return;
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    user.avatar = avatarUrl;
    await user.save();

    res.json({
      message: 'Avatar uploaded successfully',
      avatar: avatarUrl,
      user: formatUser(user),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Check approval status
// @route   GET /api/auth/approval-status
// @access  Public (by email query param)
export const checkApprovalStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const email = req.query.email as string;
    const role = req.query.role as string;
    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    const filter: any = { email };
    if (role) filter.role = role;
    const user = await User.findOne(filter);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      role: user.role,
      approvalStatus: user.approvalStatus,
      canLogin: user.canLogin(),
      message: user.getApprovalMessage()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Please provide current password and new password' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters' });
      return;
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // If user registered via Google only (no password set)
    if (!user.password) {
      res.status(400).json({ message: 'Your account uses Google sign-in. You cannot change password here.' });
      return;
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ message: 'Current password is incorrect' });
      return;
    }

    // Update password (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Add a new role to existing email account
// @route   POST /api/auth/add-role
// @access  Private (authenticated user)
export const addRole = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const {
      role, password,
      shopName, shopDescription, shopLocation,
      specialization, experienceYears, workshopLocation, workshopName
    } = req.body;

    // Validate role
    const validRoles: UserRole[] = ['buyer', 'seller', 'mechanic'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ message: 'Invalid role. Must be buyer, seller, or mechanic' });
      return;
    }

    if (!password || password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    // Validate role-specific required fields
    if (role === 'seller' && !shopName) {
      res.status(400).json({ message: 'Shop name is required for sellers' });
      return;
    }
    if (role === 'mechanic' && !specialization) {
      res.status(400).json({ message: 'Specialization is required for mechanics' });
      return;
    }

    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Check if this email already has this role
    const existingRole = await User.findOne({ email: currentUser.email, role });
    if (existingRole) {
      res.status(400).json({ message: `You already have a ${role} account` });
      return;
    }

    // Build new role account data
    const userData: any = {
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      email: currentUser.email,
      password,
      phone: currentUser.phone,
      role,
      isEmailVerified: true // Already verified via original account
    };

    if (role === 'seller') {
      userData.shopName = shopName;
      userData.shopDescription = shopDescription;
      userData.shopLocation = shopLocation;
    }
    if (role === 'mechanic') {
      userData.specialization = specialization;
      userData.experienceYears = experienceYears;
      userData.workshopLocation = workshopLocation;
      userData.workshopName = workshopName;
    }

    const newUser = await User.create(userData);

    res.status(201).json({
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} role added successfully!${
        role !== 'buyer' ? ' It is pending admin approval.' : ''
      }`,
      user: formatUser(newUser)
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(400).json({ message: 'You already have this role' });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

// @desc    Get all roles for the current user's email
// @route   GET /api/auth/my-roles
// @access  Private
export const getMyRoles = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const users = await User.find({ email: req.user.email });
    const roles = users.map(u => ({
      role: u.role,
      approvalStatus: u.approvalStatus,
      isActive: u.isActive,
      isEmailVerified: u.isEmailVerified,
      createdAt: u.createdAt
    }));

    res.json({ email: req.user.email, roles });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: errorMessage });
  }
};

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import protect from '../middleware/auth.js';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        error: {
          message: 'Name, email, and password are required',
        },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    // Prevent duplicate email registration
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        error: {
          message: 'An account with this email already exists',
        },
      });
    }

    // Create user (password is automatically hashed by User model pre-save hook)
    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password,
    });

    // Generate JWT
    const token = generateToken(user._id);

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    // Handle Mongoose duplicate key error if race condition occurs
    if (error.code === 11000) {
      return res.status(400).json({
        error: {
          message: 'An account with this email already exists',
        },
      });
    }
    next(error);
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & return JWT
 * @access  Public
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required',
        },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Explicitly select password since it is marked select: false in schema
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    // Reject unknown email without disclosing whether the account exists
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Invalid credentials',
        },
      });
    }

    // Compare supplied password with stored bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        error: {
          message: 'Invalid credentials',
        },
      });
    }

    // Generate JWT
    const token = generateToken(user._id);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user's safe profile
 * @access  Protected (Requires Bearer JWT)
 */
router.get('/me', protect, (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      bio: req.user.bio,
      avatarUrl: req.user.avatarUrl,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    },
  });
});

export default router;

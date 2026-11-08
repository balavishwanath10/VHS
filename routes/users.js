import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Tag from '../models/Tag.js';
import protect from '../middleware/auth.js';
import { isValidUrl } from '../utils/postHelpers.js';

const router = Router();

/**
 * @route   PUT /api/users/me
 * @desc    Update authenticated user's profile (name, bio, avatarUrl)
 * @access  Protected (Requires Bearer JWT)
 */
router.put('/me', protect, async (req, res, next) => {
  try {
    const { name, bio, avatarUrl } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
        },
      });
    }

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          error: {
            message: 'Name cannot be empty',
          },
        });
      }
      user.name = name.trim();
    }

    // Validate bio if provided
    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        return res.status(400).json({
          error: {
            message: 'Bio must be a string',
          },
        });
      }
      if (bio.length > 200) {
        return res.status(400).json({
          error: {
            message: 'Bio cannot exceed 200 characters',
          },
        });
      }
      user.bio = bio.trim();
    }

    // Validate avatarUrl if provided
    if (avatarUrl !== undefined && avatarUrl !== null) {
      if (avatarUrl === '') {
        user.avatarUrl = '';
      } else {
        if (typeof avatarUrl !== 'string' || !isValidUrl(avatarUrl)) {
          return res.status(400).json({
            error: {
              message: 'Avatar URL must be a valid URL',
            },
          });
        }
        user.avatarUrl = avatarUrl.trim();
      }
    }

    // Persist safe profile changes
    await user.save();

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get public user profile and published stories
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          message: 'Invalid user identifier format',
        },
      });
    }

    const user = await User.findById(id).select('name bio avatarUrl createdAt');
    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
        },
      });
    }

    // Retrieve published posts only (drafts are strictly excluded)
    const posts = await Post.find({
      author: user._id,
      status: 'published',
    })
      .sort({ createdAt: -1 })
      .populate('tags', 'name slug');

    return res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      postCount: posts.length,
      posts,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from 'express';
import mongoose from 'mongoose';
import Post from '../models/Post.js';
import Tag from '../models/Tag.js';
import protect from '../middleware/auth.js';
import { generateUniqueSlug, generateExcerpt } from '../utils/postHelpers.js';

const router = Router();

/**
 * @route   POST /api/posts
 * @desc    Create a new post (draft or published)
 * @access  Protected (Requires Bearer JWT)
 */
router.post('/', protect, async (req, res, next) => {
  try {
    const { title, content, tags, coverImage, status } = req.body;

    // Validate title presence
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        error: {
          message: 'Title is required',
        },
      });
    }

    // Validate content presence
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        error: {
          message: 'Content is required',
        },
      });
    }

    // Validate status if provided
    let postStatus = 'draft';
    if (status !== undefined && status !== null && status !== '') {
      if (status !== 'draft' && status !== 'published') {
        return res.status(400).json({
          error: {
            message: 'Status must be either draft or published',
          },
        });
      }
      postStatus = status;
    }

    // Validate tags if provided
    let postTags = [];
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags)) {
        return res.status(400).json({
          error: {
            message: 'Tags must be an array of tag IDs',
          },
        });
      }

      if (tags.length > 0) {
        // Validate each item is a valid ObjectId
        for (const tagId of tags) {
          if (!mongoose.Types.ObjectId.isValid(tagId)) {
            return res.status(400).json({
              error: {
                message: `Invalid tag identifier format: ${tagId}`,
              },
            });
          }
        }

        // Verify that all referenced tags actually exist in database
        const existingTags = await Tag.find({ _id: { $in: tags } }).select('_id');
        if (existingTags.length !== tags.length) {
          return res.status(400).json({
            error: {
              message: 'One or more specified tags do not exist',
            },
          });
        }

        postTags = tags;
      }
    }

    // Author is strictly assigned from authenticated user to prevent spoofing
    const authorId = req.user._id;

    // Generate unique slug
    const trimmedTitle = title.trim();
    let slug = await generateUniqueSlug(trimmedTitle, async (candidateSlug) => {
      const exists = await Post.exists({ slug: candidateSlug });
      return Boolean(exists);
    });

    // Generate excerpt from markdown content (max 250 characters)
    const excerpt = generateExcerpt(content, 250);

    // Clean cover image
    const cleanCoverImage = typeof coverImage === 'string' ? coverImage.trim() : '';

    // Create post
    let post;
    try {
      post = await Post.create({
        title: trimmedTitle,
        slug,
        content,
        excerpt,
        coverImage: cleanCoverImage,
        status: postStatus,
        author: authorId,
        tags: postTags,
      });
    } catch (createErr) {
      // Handle rare slug collision race condition by appending timestamp
      if (createErr.code === 11000 && createErr.keyValue && createErr.keyValue.slug) {
        slug = `${slug}-${Date.now()}`;
        post = await Post.create({
          title: trimmedTitle,
          slug,
          content,
          excerpt,
          coverImage: cleanCoverImage,
          status: postStatus,
          author: authorId,
          tags: postTags,
        });
      } else {
        throw createErr;
      }
    }

    // Populate author details and tags for response
    const populatedPost = await Post.findById(post._id)
      .populate('author', 'name email avatarUrl')
      .populate('tags', 'name slug');

    return res.status(201).json({
      message: 'Post created successfully',
      post: populatedPost,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

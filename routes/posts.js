import { Router } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Post from '../models/Post.js';
import Tag from '../models/Tag.js';
import protect from '../middleware/auth.js';
import { generateUniqueSlug, generateExcerpt, isValidUrl } from '../utils/postHelpers.js';
import { validateEnv } from '../config/validateEnv.js';

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
        for (const tagId of tags) {
          if (!mongoose.Types.ObjectId.isValid(tagId)) {
            return res.status(400).json({
              error: {
                message: `Invalid tag identifier format: ${tagId}`,
              },
            });
          }
        }

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

    // Validate cover image if provided
    let cleanCoverImage = '';
    if (coverImage !== undefined && coverImage !== null && coverImage !== '') {
      if (typeof coverImage !== 'string' || !isValidUrl(coverImage)) {
        return res.status(400).json({
          error: {
            message: 'Cover image must be a valid URL',
          },
        });
      }
      cleanCoverImage = coverImage.trim();
    }

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
      .populate('author', 'name email avatarUrl bio')
      .populate('tags', 'name slug');

    return res.status(201).json({
      message: 'Post created successfully',
      post: populatedPost,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/posts
 * @desc    Get published posts (public feed), sorted newest first
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const posts = await Post.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .populate('author', 'name email avatarUrl bio')
      .populate('tags', 'name slug');

    return res.status(200).json({
      count: posts.length,
      posts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/posts/mine
 * @desc    Get all posts belonging to the authenticated user (both draft and published)
 * @access  Protected (Requires Bearer JWT)
 */
router.get('/mine', protect, async (req, res, next) => {
  try {
    const posts = await Post.find({ author: req.user._id })
      .sort({ createdAt: -1 })
      .populate('author', 'name email avatarUrl bio')
      .populate('tags', 'name slug');

    return res.status(200).json({
      count: posts.length,
      posts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/posts/:slug
 * @desc    Get a single post by slug (public for published, author-only for drafts)
 * @access  Public (Published) / Author-only (Drafts)
 */
router.get('/:slug', async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug })
      .populate('author', 'name email avatarUrl bio')
      .populate('tags', 'name slug');

    if (!post) {
      return res.status(404).json({
        error: {
          message: 'Post not found',
        },
      });
    }

    // If post is a draft, only the author can retrieve it
    if (post.status === 'draft') {
      let isAuthor = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const { secret } = validateEnv();
          const decoded = jwt.verify(token, secret);
          if (decoded && decoded.id && post.author._id.toString() === decoded.id.toString()) {
            isAuthor = true;
          }
        } catch (_) {
          isAuthor = false;
        }
      }

      if (!isAuthor) {
        return res.status(404).json({
          error: {
            message: 'Post not found',
          },
        });
      }
    }

    return res.status(200).json({
      post,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/posts/:id
 * @desc    Update an existing post (owner only)
 * @access  Protected (Requires Bearer JWT)
 */
router.put('/:id', protect, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          message: 'Invalid post identifier format',
        },
      });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        error: {
          message: 'Post not found',
        },
      });
    }

    // Ownership check: only post owner can update
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: {
          message: 'Not authorized to update this post',
        },
      });
    }

    const { title, content, status, tags, coverImage } = req.body;

    // Validate and update title if provided
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          error: {
            message: 'Title cannot be empty',
          },
        });
      }
      const trimmedTitle = title.trim();
      if (trimmedTitle !== post.title) {
        post.title = trimmedTitle;
        post.slug = await generateUniqueSlug(trimmedTitle, async (candidateSlug) => {
          const exists = await Post.findOne({ slug: candidateSlug, _id: { $ne: post._id } });
          return Boolean(exists);
        });
      }
    }

    // Validate and update content if provided
    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({
          error: {
            message: 'Content cannot be empty',
          },
        });
      }
      post.content = content;
      post.excerpt = generateExcerpt(content, 250);
    }

    // Validate and update status if provided
    if (status !== undefined && status !== null && status !== '') {
      if (status !== 'draft' && status !== 'published') {
        return res.status(400).json({
          error: {
            message: 'Status must be either draft or published',
          },
        });
      }
      post.status = status;
    }

    // Validate and update coverImage if provided
    if (coverImage !== undefined && coverImage !== null) {
      if (coverImage === '') {
        post.coverImage = '';
      } else {
        if (typeof coverImage !== 'string' || !isValidUrl(coverImage)) {
          return res.status(400).json({
            error: {
              message: 'Cover image must be a valid URL',
            },
          });
        }
        post.coverImage = coverImage.trim();
      }
    }

    // Validate and update tags if provided
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags)) {
        return res.status(400).json({
          error: {
            message: 'Tags must be an array of tag IDs',
          },
        });
      }

      for (const tagId of tags) {
        if (!mongoose.Types.ObjectId.isValid(tagId)) {
          return res.status(400).json({
            error: {
              message: `Invalid tag identifier format: ${tagId}`,
            },
          });
        }
      }

      if (tags.length > 0) {
        const existingTags = await Tag.find({ _id: { $in: tags } }).select('_id');
        if (existingTags.length !== tags.length) {
          return res.status(400).json({
            error: {
              message: 'One or more specified tags do not exist',
            },
          });
        }
      }

      post.tags = tags;
    }

    // Save updated post (author cannot be spoofed/reassigned)
    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate('author', 'name email avatarUrl bio')
      .populate('tags', 'name slug');

    return res.status(200).json({
      message: 'Post updated successfully',
      post: updatedPost,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete an existing post (owner only)
 * @access  Protected (Requires Bearer JWT)
 */
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          message: 'Invalid post identifier format',
        },
      });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        error: {
          message: 'Post not found',
        },
      });
    }

    // Ownership check: only post owner can delete
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: {
          message: 'Not authorized to delete this post',
        },
      });
    }

    await Post.findByIdAndDelete(id);

    return res.status(200).json({
      message: 'Post deleted successfully',
      id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

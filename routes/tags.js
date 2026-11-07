import { Router } from 'express';
import Tag from '../models/Tag.js';
import Post from '../models/Post.js';

const router = Router();

/**
 * @route   GET /api/tags
 * @desc    Get all available tags with published post counts
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const tags = await Tag.find().sort({ name: 1 });

    // Calculate count of published posts associated with each tag
    const tagCounts = await Post.aggregate([
      { $match: { status: 'published' } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    for (const tc of tagCounts) {
      countMap[tc._id.toString()] = tc.count;
    }

    const tagsWithCounts = tags.map((tag) => ({
      _id: tag._id,
      name: tag.name,
      slug: tag.slug,
      postCount: countMap[tag._id.toString()] || 0,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }));

    return res.status(200).json({
      count: tagsWithCounts.length,
      tags: tagsWithCounts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/tags/:slug/posts
 * @desc    Get published posts associated with a specific tag slug, sorted newest first
 * @access  Public
 */
router.get('/:slug/posts', async (req, res, next) => {
  try {
    const normalizedSlug = (req.params.slug || '').trim().toLowerCase();

    const tag = await Tag.findOne({ slug: normalizedSlug });
    if (!tag) {
      return res.status(404).json({
        error: {
          message: 'Tag not found',
        },
      });
    }

    const posts = await Post.find({
      tags: tag._id,
      status: 'published',
    })
      .sort({ createdAt: -1 })
      .populate('author', 'name email avatarUrl bio')
      .populate('tags', 'name slug');

    return res.status(200).json({
      tag: {
        _id: tag._id,
        name: tag.name,
        slug: tag.slug,
      },
      count: posts.length,
      posts,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

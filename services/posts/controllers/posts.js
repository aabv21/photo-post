import { Post } from "../models/post.js";
import { logger } from "../middlewares/logger.js";
import axios from "axios";
import { redisClient } from "../config/redis.js";

// Cache TTL in seconds
const CACHE_TTL = 60 * 5; // 5 minutes

/**
 * Get all posts by user ID
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The posts object
 */
export const getPostsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const posts = await Post.findAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Get total count for pagination
    const count = await Post.count({
      where: { user_id: userId },
    });

    return res.status(200).json({
      success: true,
      data: posts,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error(`Get posts by user ID error: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get post by ID
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The post object
 */
export const getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `post:${id}`;

    // Try to get from cache first
    const cachedPost = await redisClient.get(cacheKey);
    if (cachedPost) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedPost),
        fromCache: true,
      });
    }

    const post = await Post.findByPk(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Fetch like count
    let likeCount = 0;
    try {
      const likesResponse = await axios.get(
        `http://localhost:3004/api/likes/posts/${post.id}/count`,
        {
          headers: {
            "x-gateway-signature": req.headers["x-gateway-signature"],
          },
        }
      );

      likeCount = likesResponse.data.data.count;
    } catch (error) {
      logger.error(
        `Error fetching likes for post ${post.id}: ${error.message}`
      );
    }

    const postWithLikes = {
      ...post.toJSON(),
      like_count: likeCount,
    };

    // Cache the result
    await redisClient.set(cacheKey, JSON.stringify(postWithLikes), {
      EX: CACHE_TTL,
    });

    return res.status(200).json({
      success: true,
      data: postWithLikes,
    });
  } catch (error) {
    logger.error(`Get post by ID error: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Create post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The created post object
 */
export const createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { caption, image_url } = req.body;

    if (!image_url) {
      return res.status(400).json({
        success: false,
        message: "Image URL is required",
      });
    }

    // Create post
    const newPost = await Post.create({
      user_id: userId,
      caption,
      image_url,
    });

    // Invalidate feed cache
    const feedCachePattern = "posts:feed:*";
    const feedCacheKeys = await redisClient.keys(feedCachePattern);
    if (feedCacheKeys.length > 0) {
      await redisClient.del(feedCacheKeys);
    }

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: newPost,
    });
  } catch (error) {
    logger.error(`Create post error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Update post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The updated post object
 */
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { caption } = req.body;

    const post = await Post.findByPk(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if user owns the post
    if (post.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this post",
      });
    }

    // Update post
    post.caption = caption;
    await post.save();

    return res.status(200).json({
      success: true,
      message: "Post updated successfully",
      data: post,
    });
  } catch (error) {
    logger.error(`Update post error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Delete post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The deleted post object
 */
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await Post.findByPk(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if user owns the post
    if (post.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this post",
      });
    }

    // Delete post
    await post.destroy();

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    logger.error(`Delete post error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get all posts (feed)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The posts object
 */
export const getAllPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const cacheKey = `posts:feed:page${page}:limit${limit}`;

    // Try to get from cache first
    const cachedPosts = await redisClient.get(cacheKey);
    if (cachedPosts) {
      return res.status(200).json(JSON.parse(cachedPosts));
    }

    const offset = (page - 1) * limit;

    const { count, rows: posts } = await Post.findAndCountAll({
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const response = {
      success: true,
      data: posts,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    };

    // Cache the result
    await redisClient.set(cacheKey, JSON.stringify(response), {
      EX: CACHE_TTL,
    });

    return res.status(200).json(response);
  } catch (error) {
    logger.error(`Get all posts error: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

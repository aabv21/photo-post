import { logger } from "../middlewares/logger.js";
import { redisClient } from "../config/redis.js";

// Models
import Like from "../models/likes.js";

// Utils
import {
  validateLikeCreation,
  validatePagination,
} from "../utils/validators.js";

// Cache TTL in seconds
const CACHE_TTL = 60 * 5; // 5 minutes

/**
 * Get all likes for a post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The likes object
 */
export const getLikesByPostId = async (req, res) => {
  try {
    const { postId } = req.params;

    // Validate pagination parameters
    const { error, value } = validatePagination(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { page, limit } = value;
    const cacheKey = `likes:post:${postId}:page${page}:limit${limit}`;

    // Try to get from cache first
    const cachedLikes = await redisClient.get(cacheKey);
    if (cachedLikes) {
      return res.status(200).json(JSON.parse(cachedLikes));
    }

    const offset = (page - 1) * limit;

    const { count, rows: likes } = await Like.findAndCountAll({
      where: { post_id: postId },
      attributes: ["id", "user_id", "post_id", "created_at"],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const response = {
      success: true,
      data: likes,
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
    logger.error(`Get likes by post ID error: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get like count for a post (internal API for posts service)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The like count object
 */
export const getLikeCountByPostId = async (req, res) => {
  try {
    const { postId } = req.params;
    const cacheKey = `likes:count:post:${postId}`;

    // Try to get from cache first
    const cachedCount = await redisClient.get(cacheKey);
    if (cachedCount) {
      return res.status(200).json({
        success: true,
        data: { count: parseInt(cachedCount) },
        fromCache: true,
      });
    }

    const count = await Like.count({
      where: { post_id: postId },
    });

    // Cache the result
    await redisClient.set(cacheKey, count.toString(), {
      EX: CACHE_TTL,
    });

    return res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error(`Get like count error: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Create a like for a post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The created like object
 */
export const createLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Validate input
    const { error } = validateLikeCreation({ postId });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    // Check if like already exists
    const existingLike = await Like.findOne({
      where: {
        post_id: postId,
        user_id: userId,
      },
    });

    if (existingLike) {
      return res.status(409).json({
        success: false,
        message: "User has already liked this post",
      });
    }

    // Create new like
    const newLike = await Like.create({
      post_id: postId,
      user_id: userId,
    });

    // Invalidate cache
    const likeCachePattern = `likes:post:${postId}:*`;
    const likeCacheKeys = await redisClient.keys(likeCachePattern);
    if (likeCacheKeys.length > 0) {
      await redisClient.del(likeCacheKeys);
    }

    await redisClient.del(`likes:count:post:${postId}`);
    await redisClient.del(`post:${postId}`);

    return res.status(201).json({
      success: true,
      message: "Post liked successfully",
      data: {
        id: newLike.id,
        post_id: newLike.post_id,
        user_id: newLike.user_id,
        created_at: newLike.created_at,
      },
    });
  } catch (error) {
    logger.error(`Create like error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Delete a like
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The deleted like object
 */
export const deleteLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Find the like
    const like = await Like.findOne({
      where: {
        post_id: postId,
        user_id: userId,
      },
    });

    if (!like) {
      return res.status(404).json({
        success: false,
        message: "Like not found",
      });
    }

    // Delete the like
    await like.destroy();

    // Invalidate cache
    await redisClient.del(`likes:post:${postId}`);
    await redisClient.del(`likes:count:post:${postId}`);
    await redisClient.del(`post:${postId}`);

    return res.status(200).json({
      success: true,
      message: "Like removed successfully",
    });
  } catch (error) {
    logger.error(`Delete like error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

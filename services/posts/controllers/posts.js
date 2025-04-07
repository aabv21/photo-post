import axios from "axios";
import path from "path";
import { logger } from "../middlewares/logger.js";
import { redisClient } from "../config/redis.js";

// Models
import Post from "../models/post.js";

// Utils
import { deleteImageFile } from "../utils/fileUtils.js";
import {
  validatePostCreation,
  validatePostUpdate,
  validateImageTransformation,
} from "../utils/validators.js";
import {
  getImagePath,
  imageExists,
  getMimeType,
  transformImage,
} from "../utils/imageUtils.js";

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
      image_url: post.image_url || null,
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
    const { caption } = req.body;

    // Validate request body
    const { error } = validatePostCreation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    // Create post
    const newPost = await Post.create({
      user_id: userId,
      caption,
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

    // Validate request body
    const { error } = validatePostUpdate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

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

    // Delete associated image file if it exists
    if (post.image_url) {
      deleteImageFile(post.image_url);
    }

    // Delete post
    await post.destroy();

    // Invalidate cache
    const cacheKey = `post:${id}`;
    await redisClient.del(cacheKey);

    // Invalidate feed cache
    const feedCachePattern = "posts:feed:*";
    const feedCacheKeys = await redisClient.keys(feedCachePattern);
    if (feedCacheKeys.length > 0) {
      await redisClient.del(feedCacheKeys);
    }

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

/**
 * Upload image to post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - Response with updated image URL
 */
export const uploadPostImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists
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
        message: "You are not authorized to modify this post",
      });
    }

    // File is available in req.file thanks to multer
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image provided",
      });
    }

    // Delete old image if it exists
    if (post.image_url) {
      deleteImageFile(post.image_url);
    }

    // Build image URL
    const baseUrl =
      process.env.BASE_URL || `http://localhost:${process.env.PORT || 3003}`;
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;

    // Update image URL in post
    post.image_url = imageUrl;
    await post.save();

    // Invalidate cache
    const cacheKey = `post:${id}`;
    await redisClient.del(cacheKey);

    // Invalidate feed cache
    const feedCachePattern = "posts:feed:*";
    const feedCacheKeys = await redisClient.keys(feedCachePattern);
    if (feedCacheKeys.length > 0) {
      await redisClient.del(feedCacheKeys);
    }

    return res.status(200).json({
      success: true,
      message: "Image uploaded and updated successfully",
      data: {
        post_id: post.id,
        image_url: post.image_url,
      },
    });
  } catch (error) {
    logger.error(`Error uploading image: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Delete image from post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - Response with success status
 */
export const deletePostImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists
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
        message: "You are not authorized to modify this post",
      });
    }

    // Check if post has an image
    if (!post.image_url) {
      return res.status(400).json({
        success: false,
        message: "Post does not have an image to delete",
      });
    }

    // Delete image file
    const deleteResult = deleteImageFile(post.image_url);

    // Update post in database
    post.image_url = null;
    await post.save();

    // Invalidate cache
    const cacheKey = `post:${id}`;
    await redisClient.del(cacheKey);

    // Invalidate feed cache
    const feedCachePattern = "posts:feed:*";
    const feedCacheKeys = await redisClient.keys(feedCachePattern);
    if (feedCacheKeys.length > 0) {
      await redisClient.del(feedCacheKeys);
    }

    return res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      data: {
        post_id: post.id,
        file_deleted: deleteResult,
      },
    });
  } catch (error) {
    logger.error(`Error deleting image: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get image with optional transformations
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const getImage = async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate transformation parameters
    const { error, value } = validateImageTransformation(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { width, height, format, quality, fit } = value;

    // Get image path and check if it exists
    const imagePath = getImagePath(filename);
    if (!imageExists(imagePath)) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Check if any transformations are requested
    const hasTransformations =
      width || height || format || quality !== 80 || fit !== "cover";

    if (!hasTransformations) {
      // Serve original file directly
      const contentType = getMimeType(filename);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day
      return res.sendFile(imagePath);
    }

    // Apply transformations
    const transform = await transformImage(imagePath, {
      width,
      height,
      format,
      quality,
      fit,
    });

    // Set appropriate Content-Type header
    const outputFormat = format || path.extname(filename).substring(1);
    res.setHeader("Content-Type", `image/${outputFormat}`);

    // Set cache headers
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day

    // Stream the transformed image
    transform.pipe(res);
  } catch (error) {
    logger.error(`Error processing image: ${error.message}`, {
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error while processing image",
    });
  }
};

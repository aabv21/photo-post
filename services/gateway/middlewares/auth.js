import jwt from "jsonwebtoken";
import { redisClient } from "../config/redis.js";
import { logger } from "./logger.js";

/**
 * Middleware to authenticate user token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Invalid token format.",
      });
    }

    // Verify token exists in Redis
    const tokenKey = `auth:token:${token}`;
    const tokenData = await redisClient.get(tokenKey);

    if (!tokenData) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    // Verify JWT signature
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "jwt-secret");
      req.user = decoded;

      // Refresh token expiry in Redis (extend session)
      await redisClient.expire(tokenKey, 60 * 60 * 24 * 7); // 7 days

      next();
    } catch (error) {
      // If token is invalid, remove it from Redis
      await redisClient.del(tokenKey);

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid token signature.",
      });
    }
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
    });
  }
};

/**
 * Generate gateway signature using JWT
 * @returns {String} JWT token for gateway signature
 */
export const generateGatewaySignature = () => {
  // Create payload with timestamp and random nonce for security
  const payload = {
    source: "gateway",
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2, 15),
  };

  // Sign with gateway secret
  return jwt.sign(
    payload,
    process.env.GATEWAY_SECRET || "gateway-secret-key",
    { expiresIn: "1h" } // Short expiry for security
  );
};

/**
 * Middleware to verify gateway signature for internal service communication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const verifyGatewaySignature = (req, res, next) => {
  try {
    const signature = req.headers["x-gateway-signature"];

    if (!signature) {
      return res.status(403).json({
        success: false,
        message: "Access denied. No gateway signature provided.",
      });
    }

    // Verify the JWT signature
    try {
      jwt.verify(signature, process.env.GATEWAY_SECRET || "gateway-secret-key");
      next();
    } catch (error) {
      logger.error(`Invalid gateway signature: ${error.message}`);
      return res.status(403).json({
        success: false,
        message: "Access denied. Invalid gateway signature.",
      });
    }
  } catch (error) {
    logger.error(`Gateway verification error: ${error.message}`, {
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Internal server error during gateway verification.",
    });
  }
};

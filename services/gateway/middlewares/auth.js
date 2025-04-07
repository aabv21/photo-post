import jwt from "jsonwebtoken";
import { redisClient } from "../config/redis.js";
import { logger } from "./logger.js";

/**
 * Middleware to authenticate JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
      (err, user) => {
        if (err) {
          logger.warn(`JWT Authentication failed: ${err.message}`);
          return res.status(403).json({
            success: false,
            message: "Invalid or expired token",
          });
        }

        req.user = user;
        next();
      }
    );
  } else {
    logger.warn("JWT Authentication failed: No token provided");
    res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
  }
};

/**
 * Generate a signature for internal service communication
 * @returns {String} JWT token for gateway authentication
 */
export const generateGatewaySignature = () => {
  try {
    const gatewaySecret = process.env.GATEWAY_SECRET || "gateway-secret-key";

    if (!gatewaySecret) {
      logger.error("Gateway secret is not defined");
      return "";
    }

    // Create a JWT token with gateway identity
    const token = jwt.sign(
      {
        service: "api-gateway",
        timestamp: Date.now(),
      },
      gatewaySecret,
      { expiresIn: "1h" }
    );

    logger.debug("Gateway signature generated successfully");
    return token;
  } catch (error) {
    logger.error(`Error generating gateway signature: ${error.message}`);
    return "";
  }
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

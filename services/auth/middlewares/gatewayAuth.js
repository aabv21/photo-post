import jwt from "jsonwebtoken";
import { logger } from "./logger.js";

// Middleware to validate that requests are coming from the API Gateway
export const validateGatewayRequest = (req, res, next) => {
  try {
    // Skip validation for health check endpoint
    if (req.path === "/health") {
      return next();
    }

    console.log(req.headers);

    // Get gateway signature from header
    const signature = req.headers["x-gateway-signature"];
    if (!signature) {
      logger.warn("Request rejected: Missing gateway signature");
      return res.status(403).json({
        success: false,
        message: "Access denied. Direct access to service is not allowed.",
      });
    }

    // Verify signature
    jwt.verify(signature, process.env.GATEWAY_SECRET || "gateway-secret-key");

    // Signature is valid, proceed
    next();
  } catch (error) {
    logger.error(`Gateway validation error: ${error.message}`);
    return res.status(403).json({
      success: false,
      message: "Access denied. Invalid gateway signature.",
    });
  }
};

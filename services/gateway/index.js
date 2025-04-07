import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Logger middleware
import loggerMiddleware, { logger } from "./middlewares/logger.js";

// Auth middleware
import {
  authenticateJWT,
  generateGatewaySignature,
} from "./middlewares/auth.js";

// Import Redis and Kafka configurations
import "./config/redis.js";
import "./config/kafka.js";

const app = express();

// Apply CORS middleware
app.use(cors());

// Apply logger middleware
app.use(loggerMiddleware);

// Health check endpoint (public)
app.get("/health", (req, res) => {
  // For this specific endpoint, parse the body
  bodyParser.json()(req, res, () => {
    res.status(200).json({
      status: "ok",
      message: "API Gateway is running",
      timestamp: new Date().toISOString(),
    });
  });
});

// Custom middleware to add gateway signature to all requests
app.use((req, res, next) => {
  const signature = generateGatewaySignature();
  logger.info(
    `Adding gateway signature to request: ${signature.substring(0, 20)}...`
  );
  req.headers["x-gateway-signature"] = signature;
  next();
});

// Create a reusable proxy configuration function
const createProxyConfig = (targetUrl, pathRewrite, additionalHandlers = {}) => {
  return {
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: pathRewrite,
    onProxyReq: (proxyReq, req, res) => {
      // Forward the gateway signature
      if (req.headers["x-gateway-signature"]) {
        proxyReq.setHeader(
          "x-gateway-signature",
          req.headers["x-gateway-signature"]
        );
        logger.info("Forwarding gateway signature to service");
      }

      // Forward user ID from JWT if available
      if (req.user && req.user.id) {
        proxyReq.setHeader("x-user-id", req.user.id);
        logger.info(`Forwarding user ID: ${req.user.id}`);
      }

      // Handle request body - only if Content-Type is application/json
      if (
        req.headers["content-type"] &&
        req.headers["content-type"].includes("application/json")
      ) {
        // Parse the body only if it hasn't been parsed yet
        if (!req.body) {
          let bodyData = "";
          req.on("data", (chunk) => {
            bodyData += chunk.toString();
          });
          req.on("end", () => {
            if (bodyData) {
              try {
                req.body = JSON.parse(bodyData);
                // Write the body to the proxy request
                proxyReq.setHeader("Content-Type", "application/json");
                proxyReq.setHeader(
                  "Content-Length",
                  Buffer.byteLength(bodyData)
                );
                proxyReq.write(bodyData);
              } catch (e) {
                logger.error(`Error parsing request body: ${e.message}`);
              }
            }
          });
        } else {
          // Body already parsed, write it to the proxy request
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader("Content-Type", "application/json");
          proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      }

      // Call additional handlers if provided
      if (additionalHandlers.onProxyReq) {
        additionalHandlers.onProxyReq(proxyReq, req, res);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      logger.info(`Service Response: ${proxyRes.statusCode}`);

      // Call additional handlers if provided
      if (additionalHandlers.onProxyRes) {
        additionalHandlers.onProxyRes(proxyRes, req, res);
      }
    },
    onError: (err, req, res) => {
      logger.error(`Service Proxy Error: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Service Error",
        message: `Failed to connect to service: ${err.message}`,
      });

      // Call additional handlers if provided
      if (additionalHandlers.onError) {
        additionalHandlers.onError(err, req, res);
      }
    },
  };
};

// Auth Service Routes (public)
app.use(
  "/api/auth",
  createProxyMiddleware(
    createProxyConfig(
      process.env.AUTH_SERVICE_URL || "http://auth:3001",
      { "^/api/auth": "/api/auth" },
      {
        onProxyRes: (proxyRes, req, res) => {
          logger.info(`Auth Service Response: ${proxyRes.statusCode}`);
        },
        onError: (err, req, res) => {
          logger.error(`Auth Service Proxy Error: ${err.message}`);
        },
      }
    )
  )
);

// Protected routes - require JWT authentication

// Protected user routes
app.use(
  "/api/users",
  authenticateJWT,
  createProxyMiddleware(
    createProxyConfig(process.env.USERS_SERVICE_URL || "http://users:3002", {
      "^/api/users": "/api/users",
    })
  )
);

// Protected posts routes (create, update, delete)
app.use(
  "/api/posts",
  authenticateJWT,
  createProxyMiddleware(
    createProxyConfig(process.env.POSTS_SERVICE_URL || "http://posts:3003", {
      "^/api/posts": "/api/posts",
    })
  )
);

// Protected likes routes
app.use(
  "/api/likes",
  authenticateJWT,
  createProxyMiddleware(
    createProxyConfig(process.env.LIKES_SERVICE_URL || "http://likes:3004", {
      "^/api/likes": "/api/likes",
    })
  )
);

// Static files for uploads
app.use(
  "/uploads",
  express.static("uploads", {
    maxAge: "1d",
  })
);

// Handle 404 errors
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});

export default app;

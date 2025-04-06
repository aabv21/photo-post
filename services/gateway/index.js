import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
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

// Import controllers
import * as userController from "./controllers/userController.js";

// Import Redis and Kafka configurations
import "./config/redis.js";
import "./config/kafka.js";

const app = express();

// Apply CORS and body parsing middleware first
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Apply logger middleware
app.use(loggerMiddleware);

// Health check endpoint (public)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API Gateway is running",
    timestamp: new Date().toISOString(),
  });
});

// Auth Service Routes (public)
app.use(
  "/api/auth",
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || "http://auth:3001",
    changeOrigin: true,
    pathRewrite: {
      "^/api/auth": "/api/auth",
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add gateway signature to requests using JWT
      proxyReq.setHeader("x-gateway-signature", generateGatewaySignature());
      fixRequestBody(proxyReq, req);
    },
    onProxyRes: (proxyRes, req, res) => {
      logger.info(`Auth Service Response: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      logger.error(`Auth Service Proxy Error: ${err.message}`);
      res.status(500).json({
        success: false,
        error: "Auth Service Error",
        message: "Failed to connect to authentication service",
      });
    },
  })
);

// Public user routes
app.get(
  "/api/users/:id",
  createProxyMiddleware({
    target: process.env.USERS_SERVICE_URL || "http://users:3002",
    changeOrigin: true,
    pathRewrite: {
      "^/api/users": "/api/users",
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add gateway signature to requests using JWT
      proxyReq.setHeader("x-gateway-signature", generateGatewaySignature());
      fixRequestBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      logger.error(`Users Service Proxy Error: ${err.message}`);
      res.status(500).json({
        success: false,
        message: "Failed to connect to users service",
      });
    },
  })
);

app.get(
  "/api/users/search",
  createProxyMiddleware({
    target: process.env.USERS_SERVICE_URL || "http://users:3002",
    changeOrigin: true,
    pathRewrite: {
      "^/api/users": "/api/users",
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add gateway signature to requests using JWT
      proxyReq.setHeader("x-gateway-signature", generateGatewaySignature());
      fixRequestBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      logger.error(`Users Service Proxy Error: ${err.message}`);
      res.status(500).json({
        success: false,
        message: "Failed to connect to users service",
      });
    },
  })
);

// Public post routes
app.get(
  "/api/posts",
  createProxyMiddleware({
    target: process.env.POSTS_SERVICE_URL || "http://posts:3003",
    changeOrigin: true,
    pathRewrite: {
      "^/api/posts": "/api/posts",
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add gateway signature to requests using JWT
      proxyReq.setHeader("x-gateway-signature", generateGatewaySignature());
      fixRequestBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      logger.error(`Posts Service Proxy Error: ${err.message}`);
      res.status(500).json({
        success: false,
        message: "Failed to connect to posts service",
      });
    },
  })
);

app.get(
  "/api/posts/:id",
  createProxyMiddleware({
    target: process.env.POSTS_SERVICE_URL || "http://posts:3003",
    changeOrigin: true,
    pathRewrite: {
      "^/api/posts": "/api/posts",
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add gateway signature to requests using JWT
      proxyReq.setHeader("x-gateway-signature", generateGatewaySignature());
      fixRequestBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      logger.error(`Posts Service Proxy Error: ${err.message}`);
      res.status(500).json({
        success: false,
        message: "Failed to connect to posts service",
      });
    },
  })
);

// Protected routes - require JWT authentication
// Apply authenticateJWT middleware to all protected routes

// Protected user routes
app.use(
  "/api/users/me",
  authenticateJWT,
  createProxyMiddleware({
    target: process.env.USERS_SERVICE_URL || "http://users:3002",
    changeOrigin: true,
    pathRewrite: {
      "^/api/users/me": "/api/users/me",
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add gateway signature using JWT and forward user info
      proxyReq.setHeader("x-gateway-signature", generateGatewaySignature());

      // Forward user ID from JWT
      if (req.user && req.user.id) {
        proxyReq.setHeader("x-user-id", req.user.id);
      }

      fixRequestBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      logger.error(`Users Service Proxy Error: ${err.message}`);
      res.status(500).json({
        success: false,
        message: "Failed to connect to users service",
      });
    },
  })
);

// Protected posts routes (create, update, delete)
app.use(
  ["/api/posts/create", "/api/posts/update", "/api/posts/delete"],
  authenticateJWT,
  createProxyMiddleware({
    target: process.env.POSTS_SERVICE_URL || "http://posts:3003",
    changeOrigin: true,
    pathRewrite: {
      "^/api/posts": "/api/posts",
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add gateway signature using JWT and forward user info
      proxyReq.setHeader("x-gateway-signature", generateGatewaySignature());

      // Forward user ID from JWT
      if (req.user && req.user.id) {
        proxyReq.setHeader("x-user-id", req.user.id);
      }

      fixRequestBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      logger.error(`Posts Service Proxy Error: ${err.message}`);
      res.status(500).json({
        success: false,
        message: "Failed to connect to posts service",
      });
    },
  })
);

// Protected likes routes
app.use(
  "/api/likes",
  authenticateJWT,
  createProxyMiddleware({
    target: process.env.LIKES_SERVICE_URL || "http://likes:3004",
    changeOrigin: true,
    pathRewrite: {
      "^/api/likes": "/api/likes",
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add gateway signature using JWT and forward user info
      proxyReq.setHeader("x-gateway-signature", generateGatewaySignature());

      // Forward user ID from JWT
      if (req.user && req.user.id) {
        proxyReq.setHeader("x-user-id", req.user.id);
      }

      fixRequestBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      logger.error(`Likes Service Proxy Error: ${err.message}`);
      res.status(500).json({
        success: false,
        message: "Failed to connect to likes service",
      });
    },
  })
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
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Gateway Error: ${err.message}`, { stack: err.stack });
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});

export default app;

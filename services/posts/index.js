import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Middlewares
import loggerMiddleware, { logger } from "./middlewares/logger.js";
import limiter from "./middlewares/limiter.js";
import { validateGatewayRequest } from "./middlewares/gatewayAuth.js";
import { uploadMiddleware } from "./middlewares/upload.js";

// Routes
import postsRouter from "./routes/posts.js";

// import config
import "./config/sqlite.js";
import "./config/redis.js";
import "./config/kafka.js";

// Express
const app = express();
const PORT = process.env.PORT || 3003;

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(loggerMiddleware);

// Validate that requests are coming from the API Gateway
app.use(validateGatewayRequest);

app.use(uploadMiddleware);
app.use(limiter);

// Routes should come after all middleware
app.use("/", postsRouter);

// Configure middleware to serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Posts Service Error: ${err.message}`, { stack: err.stack });

  if (err.name === "ValidationError") {
    res.status(400).json({
      error: "Validation Error",
      message: err.message,
    });
    return;
  }

  if (err.name === "NotFoundError") {
    res.status(404).json({
      error: "Not Found",
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  });
});

// 404 handler for unmatched routes - should be after all valid routes
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

app.listen(PORT, () => {
  logger.info(`Posts service running on port ${PORT}`);
});

export default app;

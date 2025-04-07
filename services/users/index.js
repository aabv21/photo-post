import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

// Middlewares
import loggerMiddleware, { logger } from "./middlewares/logger.js";
import limiter from "./middlewares/limiter.js";
import debounce from "./middlewares/debounce.js";
import { validateGatewayRequest } from "./middlewares/gatewayAuth.js";

// Routes
import usersRouter from "./routes/users.js";

// import config
import "./config/sqlite.js";
import "./config/redis.js";
import "./config/kafka.js";

// Express
const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(loggerMiddleware);

// Validate that requests are coming from the API Gateway
app.use(validateGatewayRequest);

app.use(debounce); // Add debounce before rate limiter
app.use(limiter);

// Routes should come after all middleware
app.use("/", usersRouter);

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Users Service Error: ${err.message}`, { stack: err.stack });

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
  logger.info(`Users service running on port ${PORT}`);
});

export default app;

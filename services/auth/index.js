import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import morgan from "morgan";

// Middlewares
import loggerMiddleware, { logger } from "./middlewares/logger";
import limiter from "./middlewares/limiter";
import debounce from "./middlewares/debounce";
import configurePassport from "./utils/passport.js";
import { validateGatewayRequest } from "./middlewares/gatewayAuth.js";

// Routes
import authRouter from "./routes/auth";

// import config
import "./config/sqlite.js";
import "./config/redis.js";
import "./config/kafka.js";

// Express
const app = express();

// Debug middleware for all requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const start = Date.now();

  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Request Body:", JSON.stringify(req.body));
  }

  // Track response
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${timestamp}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
});

// Middleware
app.use(loggerMiddleware);
app.use(responseHandler);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(debounce); // Add debounce before rate limiter
app.use(limiter);
app.use(morgan("dev"));

// Validate that requests are coming from the API Gateway
app.use(validateGatewayRequest);

// Initialize passport
const passport = configurePassport();
app.use(passport.initialize());

// Routes should come after all middleware
app.use("/auth", authRouter);

// Health check route
app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: `Auth service is running on port ${PORT}: OK` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Auth Service Error: ${err.message}`, { stack: err.stack });
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// 404 handler for unmatched routes - should be after all valid routes
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Auth service running on port ${PORT}`);
});

export default app;

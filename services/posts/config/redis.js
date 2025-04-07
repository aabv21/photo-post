import { createClient } from "redis";
import { logger } from "../middlewares/logger.js";

const username = process.env.REDIS_USERNAME;
const password = process.env.REDIS_PASSWORD;
const host = process.env.REDIS_HOST || "redis-posts";
const port = process.env.REDIS_PORT || 6379;
const config = { username, password, socket: { host, port } };

// Client
const redisClient = createClient(config);
redisClient.on("error", (err) => logger.error("Redis Client Error", err));
redisClient.on("ready", () => logger.info("Redis Client Ready"));

// Connect to Redis
const connectRedis = async () => {
  try {
    await redisClient.connect();
    logger.info("Connected to Redis successfully");
  } catch (error) {
    logger.error(`Failed to connect to Redis: ${error.message}`);
    // Retry connection after delay
    setTimeout(connectRedis, 5000);
  }
};

connectRedis();

// Graceful shutdown
process.on("SIGTERM", async () => {
  try {
    await redisClient.disconnect();
    logger.info("Redis client disconnected");
  } catch (error) {
    logger.error(`Error disconnecting Redis client: ${error.message}`);
  } finally {
    process.exit(0);
  }
});

export { redisClient };

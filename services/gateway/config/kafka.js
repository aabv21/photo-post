import { Kafka } from "kafkajs";
import { redisClient } from "./redis.js";
import { logger } from "../middlewares/logger.js";

// Kafka configuration
const kafka = new Kafka({
  clientId: "gateway-service",
  brokers: process.env.KAFKA_BROKER
    ? [process.env.KAFKA_BROKER]
    : ["localhost:9092"],
  ssl: process.env.KAFKA_SSL === "true",
  sasl:
    process.env.KAFKA_SASL === "true"
      ? {
          mechanism: process.env.KAFKA_SASL_MECHANISM || "plain",
          username: process.env.KAFKA_SASL_USERNAME,
          password: process.env.KAFKA_SASL_PASSWORD,
        }
      : undefined,
  connectionTimeout: 3000,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

// Producer instance
const producer = kafka.producer();

// Consumer instance
const consumer = kafka.consumer({ groupId: "gateway-group" });

// Initialize producer
const initProducer = async () => {
  try {
    await producer.connect();
    logger.info("Kafka producer connected successfully");
  } catch (error) {
    logger.error(`Failed to connect Kafka producer: ${error.message}`);
    // Retry connection after delay
    setTimeout(initProducer, 5000);
  }
};

// Initialize consumer
const initConsumer = async () => {
  try {
    await consumer.connect();
    logger.info("Kafka consumer connected successfully");

    // Subscribe to auth topics
    await consumer.subscribe({ topics: ["auth-events"], fromBeginning: false });

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageValue = JSON.parse(message.value.toString());
          logger.info(`Received message from topic ${topic}: ${message.value}`);

          // Handle different event types
          switch (messageValue.event) {
            case "user_login":
              await handleUserLogin(messageValue.data);
              break;
            case "user_logout":
              await handleUserLogout(messageValue.data);
              break;
            case "token_invalidated":
              await handleTokenInvalidated(messageValue.data);
              break;
            default:
              logger.warn(`Unknown event type: ${messageValue.event}`);
          }
        } catch (error) {
          logger.error(`Error processing Kafka message: ${error.message}`, {
            stack: error.stack,
          });
        }
      },
    });
  } catch (error) {
    logger.error(`Failed to connect Kafka consumer: ${error.message}`);
    // Retry connection after delay
    setTimeout(initConsumer, 5000);
  }
};

// Handle user login event
const handleUserLogin = async (data) => {
  try {
    const { token, user, expiresIn } = data;
    const tokenKey = `auth:token:${token}`;

    // Store token data in Redis
    await redisClient.set(tokenKey, JSON.stringify(user), {
      EX: expiresIn,
    });

    // Store user session
    const userSessionsKey = `auth:user:${user.id}:sessions`;
    await redisClient.sAdd(userSessionsKey, token);

    logger.info(`User login session stored for user ${user.id}`);
  } catch (error) {
    logger.error(`Error handling user login event: ${error.message}`, {
      stack: error.stack,
    });
  }
};

// Handle user logout event
const handleUserLogout = async (data) => {
  try {
    const { token, userId } = data;
    const tokenKey = `auth:token:${token}`;

    // Remove token from Redis
    await redisClient.del(tokenKey);

    // Remove token from user sessions
    if (userId) {
      const userSessionsKey = `auth:user:${userId}:sessions`;
      await redisClient.sRem(userSessionsKey, token);
    }

    logger.info(`User logout processed for token ${token}`);
  } catch (error) {
    logger.error(`Error handling user logout event: ${error.message}`, {
      stack: error.stack,
    });
  }
};

// Handle token invalidated event
const handleTokenInvalidated = async (data) => {
  try {
    const { token } = data;
    const tokenKey = `auth:token:${token}`;

    // Remove token from Redis
    await redisClient.del(tokenKey);

    logger.info(`Token invalidated: ${token}`);
  } catch (error) {
    logger.error(`Error handling token invalidated event: ${error.message}`, {
      stack: error.stack,
    });
  }
};

// Initialize Kafka
initProducer();
initConsumer();

// Graceful shutdown
process.on("SIGTERM", async () => {
  try {
    await consumer.disconnect();
    logger.info("Kafka consumer disconnected");

    await producer.disconnect();
    logger.info("Kafka producer disconnected");
  } catch (error) {
    logger.error(`Error disconnecting Kafka: ${error.message}`);
  } finally {
    process.exit(0);
  }
});

// Publish message to Kafka topic
export const publishMessage = async (topic, message) => {
  try {
    if (!producer || !producer.isConnected) {
      throw new Error("Kafka producer not connected");
    }

    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
          timestamp: Date.now().toString(),
        },
      ],
    });

    return true;
  } catch (error) {
    logger.error(`Failed to publish message to Kafka: ${error.message}`);
    throw error;
  }
};

export { kafka, producer, consumer };

import { Kafka } from "kafkajs";
import dotenv from "dotenv";
import { logger } from "../middlewares/logger.js";
import { createUserFromEvent } from "../controllers/users.js";

// Load environment variables
dotenv.config();

// Kafka configuration
const kafka = new Kafka({
  clientId: "users-service",
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

// Create consumer
const consumer = kafka.consumer({ groupId: "users-service-group" });

// Initialize consumer
const initConsumer = async () => {
  try {
    await consumer.connect();
    logger.info("Kafka consumer connected successfully");

    // Subscribe to user events topic
    await consumer.subscribe({ topic: "user-events", fromBeginning: false });

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageValue = JSON.parse(message.value.toString());
          logger.info(`Received Kafka message: ${messageValue.event}`);

          // Handle different event types
          if (messageValue.event === "user-created") {
            await createUserFromEvent(messageValue.data);
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

// Create producer
const producer = kafka.producer();

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

// Initialize Kafka
initConsumer();
initProducer();

// Graceful shutdown
process.on("SIGTERM", async () => {
  try {
    await consumer.disconnect();
    await producer.disconnect();
    logger.info("Kafka connections closed");
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

export default kafka;

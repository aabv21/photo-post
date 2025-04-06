import { Kafka } from "kafkajs";
import dotenv from "dotenv";
import { logger } from "../middlewares/logger.js";

// Load environment variables
dotenv.config();

// Kafka configuration
const kafka = new Kafka({
  clientId: "auth-service",
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

// Consumer factory function
const createConsumer = (groupId) => kafka.consumer({ groupId });

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
initProducer();

// Graceful shutdown
process.on("SIGTERM", async () => {
  try {
    await producer.disconnect();
    logger.info("Kafka producer disconnected");
  } catch (error) {
    logger.error(`Error disconnecting Kafka producer: ${error.message}`);
  } finally {
    process.exit(0);
  }
});

// Helper function to send messages
const sendMessage = async (topic, messages) => {
  try {
    await producer.connect();
    await producer.send({
      topic,
      messages: Array.isArray(messages)
        ? messages
        : [{ value: JSON.stringify(messages) }],
    });
    return true;
  } catch (error) {
    console.error("Error sending Kafka message:", error);
    throw error;
  }
};

// Helper function to subscribe to topics
const subscribeToTopic = async (consumer, topic, callback) => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = JSON.parse(message.value.toString());
          await callback(value, topic, partition);
        } catch (error) {
          console.error("Error processing Kafka message:", error);
        }
      },
    });

    return true;
  } catch (error) {
    console.error("Error subscribing to Kafka topic:", error);
    throw error;
  }
};

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

export { kafka, producer, createConsumer, sendMessage, subscribeToTopic };

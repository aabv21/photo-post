import { Kafka } from "kafkajs";
import { logger } from "../middlewares/logger.js";
import { createUserFromEvent } from "../controllers/users.js";

/**
 * Kafka configuration for Users service
 * Handles user profile events and updates
 */
const kafka = new Kafka({
  clientId: "users-service",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  retry: {
    initialRetryTime: 1000,
    retries: 10,
  },
});

// Initialize producer and consumer instances
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "users-group" });

/**
 * Connect to Kafka producer with retry mechanism
 * @returns {Object} - Connected Kafka producer
 */
export const connectProducer = async () => {
  try {
    await producer.connect();
    logger.info("Kafka producer connected successfully");
    return producer;
  } catch (error) {
    logger.error(`Failed to connect Kafka producer: ${error.message}`);
    // Manual retry after a delay in non-test environments
    if (process.env.NODE_ENV !== "test") {
      logger.info("Retrying Kafka connection in 5 seconds...");
      setTimeout(connectProducer, 5000);
    }
    throw error;
  }
};

/**
 * Publish a message to a Kafka topic
 * @param {string} topic - The Kafka topic to publish to
 * @param {Object} message - The message object to publish
 * @returns {boolean} - Success status
 */
export const publishMessage = async (topic, message) => {
  try {
    // Ensure producer is connected before sending
    if (!producer.isConnected) {
      await connectProducer();
    }

    // Send message to Kafka topic
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });

    logger.info(`Message published to topic ${topic}`);
    return true;
  } catch (error) {
    logger.error(`Error publishing message to Kafka: ${error.message}`);
    return false;
  }
};

/**
 * Connect to Kafka consumer
 * @returns {Object} - Connected Kafka consumer
 */
export const connectConsumer = async () => {
  try {
    await consumer.connect();
    logger.info("Kafka consumer connected successfully");
    return consumer;
  } catch (error) {
    logger.error(`Failed to connect Kafka consumer: ${error.message}`);
    throw error;
  }
};

/**
 * Subscribe to a Kafka topic
 * @param {string} topic - The Kafka topic to subscribe to
 * @returns {boolean} - Success status
 */
export const subscribeToTopic = async (topic) => {
  try {
    await consumer.subscribe({ topic, fromBeginning: true });
    logger.info(`Subscribed to topic ${topic}`);
    return true;
  } catch (error) {
    logger.error(`Error subscribing to topic ${topic}: ${error.message}`);
    return false;
  }
};

/**
 * Start consuming messages from subscribed topics
 * @param {Function} messageHandler - Function to handle received messages
 * @returns {boolean} - Success status
 */
export const startConsumer = async (messageHandler) => {
  try {
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const value = message.value.toString();
        logger.info(`Received message from topic ${topic}: ${value}`);

        try {
          // Parse and process the message
          const parsedMessage = JSON.parse(value);
          await messageHandler(topic, parsedMessage);
        } catch (error) {
          logger.error(`Error processing message: ${error.message}`);
        }
      },
    });

    logger.info("Kafka consumer started");
    return true;
  } catch (error) {
    logger.error(`Error starting Kafka consumer: ${error.message}`);
    return false;
  }
};

/**
 * Disconnect from Kafka producer and consumer
 * @returns {boolean} - Success status
 */
export const disconnect = async () => {
  try {
    await producer.disconnect();
    await consumer.disconnect();
    logger.info("Kafka producer and consumer disconnected");
    return true;
  } catch (error) {
    logger.error(`Error disconnecting from Kafka: ${error.message}`);
    return false;
  }
};

/**
 * Initialize Kafka consumer with message handlers
 * @returns {boolean} - Success status
 */
export const initializeKafkaConsumer = async () => {
  try {
    // Connect to Kafka
    await connectConsumer();

    // Subscribe to user-events topic
    await subscribeToTopic("user-events");

    // Start consuming messages with appropriate handlers
    await startConsumer(async (topic, message) => {
      if (topic === "user-events") {
        if (message.event === "user-created") {
          logger.info(
            `Processing user-created event for user ${message.data.id}`
          );
          try {
            await createUserFromEvent(message.data);
          } catch (error) {
            logger.error(`Failed to create user from event: ${error.message}`);
          }
        } else {
          logger.info(`Received unknown event type: ${message.event}`);
        }
      }
    });

    logger.info("Kafka consumer initialized successfully");
    return true;
  } catch (error) {
    logger.error(`Failed to initialize Kafka consumer: ${error.message}`);
    return false;
  }
};

// Start the Kafka consumer when the application starts
initializeKafkaConsumer()
  .then(() => {
    logger.info("Kafka consumer initialized successfully");
  })
  .catch((error) => {
    logger.error(`Failed to initialize Kafka consumer: ${error.message}`);
  });

// Export Kafka instances
export { producer, consumer };

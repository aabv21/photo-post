import { Kafka } from "kafkajs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Kafka configuration
const kafka = new Kafka({
  clientId: "likes-service",
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

export { kafka, producer, createConsumer, sendMessage, subscribeToTopic };

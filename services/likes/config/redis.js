import { createClient } from "redis";

const username = process.env.REDIS_USERNAME;
const password = process.env.REDIS_PASSWORD;
const host = process.env.REDIS_HOST;
const port = process.env.REDIS_PORT;
const config = { username, password, socket: { host, port } };

// Client
const redisClient = createClient(config);
redisClient.on("error", (err) => console.log("Redis Client Error", err));
redisClient.on("ready", () => console.log("Redis Client Ready"));
await redisClient.connect();

// Clear all data in the database
redisClient.flushDb();

// Suscriber
const redisSubscriber = createClient(config);
redisSubscriber.on("error", (err) =>
  console.log("Redis Subscriber Error", err)
);
redisSubscriber.on("ready", () => console.log("Redis Subscriber Ready"));
await redisSubscriber.connect();

// Publisher
const redisPublisher = createClient(config);
redisPublisher.on("error", (err) => console.log("Redis Publisher Error", err));
redisPublisher.on("ready", () => console.log("Redis Publisher Ready"));
await redisPublisher.connect();

export { redisClient, redisSubscriber, redisPublisher };

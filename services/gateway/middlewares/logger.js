import winston from "winston";

// Create Winston logger
const logger = winston.createLogger({
  level: "info",
  levels: winston.config.npm.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
});

// Middleware
const loggerMiddleware = (req, res, next) => {
  const start = Date.now();

  // Log initial request
  logger.info(`Incoming ${req.method} ${req.originalUrl}`);

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - start;
    const logMessage = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 400) {
      logger.error(`${logMessage} - ${JSON.stringify(data)}`);
    } else {
      logger.info(`${logMessage}`);
    }

    originalJson.call(this, data);
  };

  next();
};

// Export the logger instance
export { logger };
export default loggerMiddleware;

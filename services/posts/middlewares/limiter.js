import { rateLimit } from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // Limit each IP to 30 requests per `window`
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

export default limiter;

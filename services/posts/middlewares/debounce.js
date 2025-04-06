// Rate Limiter with Debounce
const debounceTime = 1000; // 1 second debounce
let lastRequestTime = {};

const debounce = (req, res, next) => {
  const ip = req.ip;
  const currentTime = Date.now();

  if (lastRequestTime[ip] && currentTime - lastRequestTime[ip] < debounceTime) {
    return res.error("Please wait before making another request", 429);
  }

  lastRequestTime[ip] = currentTime;
  next();
};

export default debounce;

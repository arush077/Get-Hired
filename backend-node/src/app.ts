import express from "express";
import cors from "cors";
import { getConfig } from "./config/env.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import healthRouter from "./routes/health.js";

export function createApp() {
  const config = getConfig();

  const app = express();

  app.use(requestIdMiddleware);

  app.use(
    cors({
      origin: config.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
      credentials: true,
      methods: ["*"],
      allowedHeaders: ["*"],
      exposedHeaders: ["X-Request-Id", "Retry-After"],
    }),
  );

  app.use(requestLogger);
  app.use(express.json());
  app.use(healthRouter);

  return app;
}

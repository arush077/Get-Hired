import express from "express";
import cors from "cors";
import multer from "multer";
import { getConfig } from "./config/env.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { authMiddleware } from "./middleware/auth.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import resumeRouter from "./routes/resume.js";
import interviewRouter from "./routes/interview.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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
  app.use("/api/auth", authRouter);

  // Auth middleware applied globally after public routes
  app.use(authMiddleware);

  // Protected routes
  app.use("/api/resumes", upload.single("file"), resumeRouter);
  app.use("/api/interviews", interviewRouter);

  return app;
}

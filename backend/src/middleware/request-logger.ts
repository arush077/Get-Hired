import type { Request, Response, NextFunction } from "express";
import { getLogger } from "../logging/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const logger = getLogger();
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration_ms: duration,
        request_id: req.requestId,
      },
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
    );
  });

  next();
}

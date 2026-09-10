import pino from "pino";
import { getConfig } from "../config/env.js";

let _logger = null;

export function getLogger() {
  if (!_logger) {
    const config = getConfig();
    _logger = pino({
      level: config.LOG_LEVEL,
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    });
  }
  return _logger;
}

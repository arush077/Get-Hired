import { createApp } from "./app.js";
import { getConfig } from "./config/env.js";
import { getLogger } from "./logging/logger.js";

const config = getConfig();
const logger = getLogger();

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "[gethired] server listening");
});

function shutdown() {
  logger.info("[gethired] shutting down...");
  server.close(() => {
    logger.info("[gethired] server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

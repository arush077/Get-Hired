import { createApp } from "./app.js";

const PORT = process.env.PORT ?? 8000;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[gethired] server listening on port ${PORT}`);
});

function shutdown() {
  console.log("[gethired] shutting down...");
  server.close(() => {
    console.log("[gethired] server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

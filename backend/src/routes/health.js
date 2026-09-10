import { Router } from "express";
import { checkDatabaseConnection } from "../infrastructure/db/health.js";

const router = Router();

router.get("/health", async (_req, res) => {
  const dbConnected = await checkDatabaseConnection();
  res.json({
    status: "ok",
    service: "gethired",
    database: dbConnected ? "connected" : "disconnected",
  });
});

export default router;

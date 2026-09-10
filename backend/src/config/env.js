import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  JINA_API_KEY: z.string().default(""),
  ALLOWED_ORIGINS: z
    .string()
    .default("https://get-hired-weld.vercel.app"),
  REDIS_URL: z.string().default(""),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("[config] invalid environment variables:");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

let _config = null;

export function getConfig() {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

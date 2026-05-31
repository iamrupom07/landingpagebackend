import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { corsOrigins } from "./config/env";
import { pingRedis } from "./config/redis";
import { requestIdMiddleware } from "./middlewares/requestId.middleware";
import { requestLogger } from "./middlewares/logger.middleware";
import { errorHandler } from "./middlewares/error.middleware";
import { createRateLimiter } from "./middlewares/rateLimit.middleware";
import leadsRouter from "./modules/leads/leads.router";
import authRouter from "./modules/auth/auth.router";
import analyticsRouter from "./modules/analytics/analytics.router";
import { prisma } from "./db/prisma";

const app = express();

app.set("trust proxy", 1);
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin "${origin}" is not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  }),
);
app.use(compression());

const globalLimiter = createRateLimiter({
  name: "global",
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

const leadSubmitLimiter = createRateLimiter({
  name: "lead-submit",
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many submissions from this IP. Please try again later.",
  },
  skip: (req) => req.method !== "POST",
});

app.use(globalLimiter);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Basic health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Deep health check — tests the actual DB connection and reports any error
app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ status: "error", db: "failed", error: message });
  }
});

app.get("/health/ready", async (_req, res) => {
  const checks = { db: "unknown", redis: "unknown" };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "connected";
  } catch {
    checks.db = "failed";
  }

  try {
    checks.redis = (await pingRedis()) ? "connected" : "not_configured";
  } catch {
    checks.redis = "failed";
  }

  const healthy = checks.db === "connected" && checks.redis === "connected";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "error",
    checks,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/leads", leadSubmitLimiter, leadsRouter);
app.use("/api/analytics", analyticsRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

export default app;

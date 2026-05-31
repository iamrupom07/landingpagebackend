import app from "./app";
import { env } from "./config/env";
import { prisma } from "./db/prisma";

const PORT = Number(env.PORT);

async function bootstrap() {
  // NOTE: prisma.$connect() / prisma.$disconnect() are NOT supported when using
  // Prisma v7 driver adapters (PrismaPg). The pg.Pool manages its own connection
  // lifecycle. Calling $connect() throws "Driver adapters do not support
  // $connect()". We validate the DB is reachable instead with a lightweight query.
  try {
    await (prisma as any).$queryRaw`SELECT 1`;
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${env.NODE_ENV}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — starting graceful shutdown...`);
    server.close(async () => {
      console.log("🔌 HTTP server closed");
      // Use $disconnect() only if available (non-adapter clients); driver-adapter
      // clients don't expose it — the pool is cleaned up automatically on process exit.
      if (typeof (prisma as any).$disconnect === "function") {
        try {
          await (prisma as any).$disconnect();
        } catch {
          /* ignore */
        }
      }
      console.log("🗄️  Database disconnected");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("❌ Forced exit");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("💥 Unhandled rejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("💥 Uncaught exception:", err);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});

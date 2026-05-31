import app from "./app";
import { env } from "./config/env";
import { closeRedis } from "./config/redis";
import { closePrisma, prisma } from "./db/prisma";
import { closeEmailQueue } from "./modules/email/email.queue";
import { emailService } from "./modules/email/email.service";

const PORT = Number(env.PORT);

async function bootstrap() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Database connected");
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }

  try {
    const smtpReady = await emailService.verifyTransport();
    console.log(smtpReady ? "SMTP transport verified" : "SMTP not configured");
  } catch (err) {
    console.error("SMTP verification failed:", err);
    if (env.NODE_ENV === "production") process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received - starting graceful shutdown`);
    server.close(async () => {
      await closeEmailQueue();
      await closeRedis();
      await closePrisma();
      console.log("Shutdown complete");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Forced exit");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

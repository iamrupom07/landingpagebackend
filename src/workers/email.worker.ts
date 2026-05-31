import { Worker } from "bullmq";
import { getBullMqConnectionOptions } from "../config/redis";
import { EMAIL_QUEUE_NAME } from "../modules/email/email.queue";
import { emailService } from "../modules/email/email.service";
import type { EmailJobData } from "../modules/email/email.types";

// FIX: Remove the unused `prisma` import. The email worker is a separate
// process; importing prisma here created a redundant connection pool that was
// only used for the $disconnect() call in shutdown. emailService already owns
// its own prisma instance (via the shared singleton in src/db/prisma.ts), so
// calling prisma.$disconnect() from the worker was disconnecting the shared
// client mid-flight and could corrupt in-progress email jobs.
// The emailService singleton handles its own cleanup when the process exits.

const connection = getBullMqConnectionOptions();

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    await emailService.processJob(job.data);
  },
  { connection, concurrency: 5 },
);

worker.on("completed", (job) => {
  console.log(`Email job completed: ${job.id} (${job.name})`);
});

worker.on("failed", (job, err) => {
  console.error(
    `Email job failed: ${job?.id ?? "unknown"} (${job?.name ?? "unknown"})`,
    err,
  );
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received - closing email worker`);
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

import { Worker } from 'bullmq';
import { getBullMqConnectionOptions } from '../config/redis';
import { prisma } from '../db/prisma';
import { EMAIL_QUEUE_NAME } from '../modules/email/email.queue';
import { emailService } from '../modules/email/email.service';
import type { EmailJobData } from '../modules/email/email.types';

const connection = getBullMqConnectionOptions();

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    await emailService.processJob(job.data);
  },
  { connection, concurrency: 5 },
);

worker.on('completed', (job) => {
  console.log(`Email job completed: ${job.id} (${job.name})`);
});

worker.on('failed', (job, err) => {
  console.error(`Email job failed: ${job?.id ?? 'unknown'} (${job?.name ?? 'unknown'})`, err);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received - closing email worker`);
  await worker.close();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

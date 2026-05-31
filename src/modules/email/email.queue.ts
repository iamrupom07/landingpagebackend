import { Queue } from "bullmq";
import { env } from "../../config/env";
import { getBullMqConnectionOptions } from "../../config/redis";
import { emailService } from "./email.service";
import type { EmailJobData } from "./email.types";

export const EMAIL_QUEUE_NAME = "email";

// FIX: Use null (not undefined) as the "closed/unavailable" sentinel so the
// pattern is consistent with getRedis() in config/redis.ts.
// Previously closeEmailQueue() set queue = undefined, which caused getQueue()
// to re-initialise a new Queue instance on the next call even after shutdown.
// With null, getQueue() treats it as "permanently closed" and returns null.
let queue: Queue | null = null;
let queueInitialised = false;

function getQueue(): Queue | null {
  if (!env.REDIS_URL) return null;
  if (queueInitialised) return queue;

  queue = new Queue(EMAIL_QUEUE_NAME, {
    connection: getBullMqConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
    },
  });

  queueInitialised = true;
  return queue;
}

export async function enqueueEmailJob(
  data: EmailJobData,
): Promise<{ queued: boolean }> {
  const emailQueue = getQueue();
  if (!emailQueue) {
    await emailService.processJob(data);
    return { queued: false };
  }

  await emailQueue.add(data.type, data);
  return { queued: true };
}

export async function closeEmailQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  // Keep queueInitialised = true so getQueue() won't attempt to re-create
  // a new Queue after the server has started shutting down.
  queueInitialised = true;
}

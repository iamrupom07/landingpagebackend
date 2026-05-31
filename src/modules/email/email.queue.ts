import { Queue } from 'bullmq';
import { env } from '../../config/env';
import { getBullMqConnectionOptions } from '../../config/redis';
import { emailService } from './email.service';
import type { EmailJobData } from './email.types';

export const EMAIL_QUEUE_NAME = 'email';

let queue: Queue | null | undefined;

function getQueue(): Queue | null {
  if (!env.REDIS_URL) return null;
  if (queue !== undefined) return queue;

  queue = new Queue(EMAIL_QUEUE_NAME, {
    connection: getBullMqConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
    },
  });

  return queue;
}

export async function enqueueEmailJob(data: EmailJobData): Promise<{ queued: boolean }> {
  const emailQueue = getQueue();
  if (!emailQueue) {
    await emailService.processJob(data);
    return { queued: false };
  }

  await emailQueue.add(data.type, data);
  return { queued: true };
}

export async function closeEmailQueue(): Promise<void> {
  if (queue) await queue.close();
  queue = undefined;
}

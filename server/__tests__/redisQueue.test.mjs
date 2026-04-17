import { describe, expect, it } from 'vitest';

process.env.REDIS_URL = 'redis://127.0.0.1:1';

const { dequeueQueueItem, enqueueQueueItem } = await import('../redisClient.mjs');

describe('Queue primitives (in-memory fallback)', () => {
  const prefix = `queue_test_${Date.now()}`;

  it('returns null when the queue is empty', async () => {
    const nextItem = await dequeueQueueItem(`${prefix}:empty`);
    expect(nextItem).toBeNull();
  });

  it('preserves FIFO order for queued jobs', async () => {
    const queueKey = `${prefix}:fifo`;

    await enqueueQueueItem(queueKey, 'first');
    await enqueueQueueItem(queueKey, 'second');
    await enqueueQueueItem(queueKey, 'third');

    expect(await dequeueQueueItem(queueKey)).toBe('first');
    expect(await dequeueQueueItem(queueKey)).toBe('second');
    expect(await dequeueQueueItem(queueKey)).toBe('third');
    expect(await dequeueQueueItem(queueKey)).toBeNull();
  });
});

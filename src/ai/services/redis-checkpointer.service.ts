import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseCheckpointSaver,
  type CheckpointTuple,
  type CheckpointMetadata,
  type Checkpoint,
} from '@langchain/langgraph';
import type { RunnableConfig } from '@langchain/core/runnables';
import type {
  PendingWrite,
  CheckpointPendingWrite,
} from '@langchain/langgraph-checkpoint';
import Redis from 'ioredis';

// TTL for chat thread state in Redis: 7 days
const THREAD_TTL_SECONDS = 7 * 24 * 60 * 60;
const KEY_PREFIX = 'langgraph:thread';

@Injectable()
export class RedisCheckpointerService
  extends BaseCheckpointSaver
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisCheckpointerService.name);
  private redis: Redis;
  private connected = false;

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit() {
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.logger.log(`Connecting to Redis at ${redisUrl}...`);

    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    try {
      await this.redis.connect();
      await this.redis.ping();
      this.connected = true;
      this.logger.log('Redis connected — chat thread persistence enabled.');
    } catch (error) {
      this.logger.warn(
        'Redis connection failed — falling back to in-memory state. Threads will not persist across restarts.',
      );
      if (error instanceof Error) {
        this.logger.debug(error.message);
      }
      this.connected = false;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis connection closed.');
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private checkpointKey(threadId: string, ns: string, checkpointId: string) {
    return `${KEY_PREFIX}:${threadId}:${ns}:cp:${checkpointId}`;
  }

  private checkpointIndexKey(threadId: string, ns: string) {
    return `${KEY_PREFIX}:${threadId}:${ns}:index`;
  }

  private pendingWritesKey(threadId: string, ns: string, checkpointId: string) {
    return `${KEY_PREFIX}:${threadId}:${ns}:writes:${checkpointId}`;
  }

  private extractConfig(config: RunnableConfig) {
    const threadId = config.configurable?.thread_id as string;
    const ns = (config.configurable?.checkpoint_ns as string) ?? '';
    const checkpointId = config.configurable?.checkpoint_id as
      | string
      | undefined;
    return { threadId, ns, checkpointId };
  }

  // ─── BaseCheckpointSaver interface ──────────────────────────────────────────

  getNextVersion(current: number | undefined): number {
    return (current ?? 0) + 1;
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    if (!this.connected) return undefined;

    const { threadId, ns, checkpointId } = this.extractConfig(config);
    if (!threadId) return undefined;

    try {
      let targetId = checkpointId;

      if (!targetId) {
        // Get the most recent checkpoint ID
        const ids = await this.redis.zrange(
          this.checkpointIndexKey(threadId, ns),
          -1,
          -1,
        );
        if (!ids.length) return undefined;
        targetId = ids[0];
      }

      const raw = await this.redis.get(
        this.checkpointKey(threadId, ns, targetId),
      );
      if (!raw) return undefined;

      const stored = JSON.parse(raw) as {
        checkpoint: Checkpoint;
        metadata: CheckpointMetadata;
        parentId?: string;
      };

      // Load pending writes for this checkpoint (stored as CheckpointPendingWrite = [taskId, channel, value])
      const writesRaw = await this.redis.get(
        this.pendingWritesKey(threadId, ns, targetId),
      );
      const pendingWrites: CheckpointPendingWrite[] = writesRaw
        ? JSON.parse(writesRaw)
        : [];

      const resultConfig: RunnableConfig = {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: ns,
          checkpoint_id: targetId,
        },
      };

      const parentConfig: RunnableConfig | undefined = stored.parentId
        ? {
            configurable: {
              thread_id: threadId,
              checkpoint_ns: ns,
              checkpoint_id: stored.parentId,
            },
          }
        : undefined;

      return {
        config: resultConfig,
        checkpoint: stored.checkpoint,
        metadata: stored.metadata,
        parentConfig,
        pendingWrites,
      } as unknown as CheckpointTuple;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`getTuple error: ${error.message}`);
      }
      return undefined;
    }
  }

  async *list(
    config: RunnableConfig,
    options?: { limit?: number; before?: RunnableConfig },
  ): AsyncGenerator<CheckpointTuple> {
    if (!this.connected) return;

    const { threadId, ns } = this.extractConfig(config);
    if (!threadId) return;

    try {
      const beforeId = options?.before?.configurable?.checkpoint_id as
        | string
        | undefined;
      const limit = options?.limit ?? 10;

      const ids = await this.redis.zrevrange(
        this.checkpointIndexKey(threadId, ns),
        0,
        -1,
      );

      let count = 0;
      for (const id of ids) {
        if (beforeId && id >= beforeId) continue;
        if (count >= limit) break;

        const tuple = await this.getTuple({
          configurable: {
            thread_id: threadId,
            checkpoint_ns: ns,
            checkpoint_id: id,
          },
        });
        if (tuple) {
          yield tuple;
          count++;
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`list error: ${error.message}`);
      }
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    if (!this.connected) {
      return {
        configurable: {
          thread_id: config.configurable?.thread_id,
          checkpoint_ns: config.configurable?.checkpoint_ns ?? '',
          checkpoint_id: checkpoint.id,
        },
      };
    }

    const { threadId, ns, checkpointId: parentId } = this.extractConfig(config);
    if (!threadId) return config;

    try {
      const cpKey = this.checkpointKey(threadId, ns, checkpoint.id);
      const indexKey = this.checkpointIndexKey(threadId, ns);
      const score = Date.now();
      const payload = JSON.stringify({ checkpoint, metadata, parentId });

      const pipeline = this.redis.pipeline();
      pipeline.set(cpKey, payload, 'EX', THREAD_TTL_SECONDS);
      pipeline.zadd(indexKey, score, checkpoint.id);
      pipeline.expire(indexKey, THREAD_TTL_SECONDS);
      await pipeline.exec();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`put error: ${error.message}`);
      }
    }

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: ns,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    if (!this.connected) return;

    const { threadId, ns, checkpointId } = this.extractConfig(config);
    if (!threadId || !checkpointId) return;

    try {
      const key = this.pendingWritesKey(threadId, ns, checkpointId);
      const existing = await this.redis.get(key);
      const current: CheckpointPendingWrite[] = existing
        ? JSON.parse(existing)
        : [];
      // Prepend taskId to each write to form CheckpointPendingWrite [taskId, channel, value]
      const incoming: CheckpointPendingWrite[] = writes.map(
        (w) => [taskId, ...w] as CheckpointPendingWrite,
      );
      // Replace writes from the same taskId, add new ones
      const merged = [...current.filter((w) => w[0] !== taskId), ...incoming];
      await this.redis.set(
        key,
        JSON.stringify(merged),
        'EX',
        THREAD_TTL_SECONDS,
      );
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`putWrites error: ${error.message}`);
      }
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    if (!this.connected) return;

    try {
      // Find all keys for this thread and delete them
      const keys = await this.redis.keys(`${KEY_PREFIX}:${threadId}:*`);
      if (keys.length) {
        await this.redis.del(...keys);
        this.logger.debug(
          `Deleted ${keys.length} Redis keys for thread ${threadId}`,
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`deleteThread error: ${error.message}`);
      }
    }
  }
}

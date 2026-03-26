import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type { BehaviorEventDto } from '../dto/user-behavior.dto';

/**
 * Manages the `user_behavior` Qdrant collection.
 *
 * Each point in the collection represents a single behavior event
 * (view, click, bookmark, etc.) with the listing context embedded
 * as a vector so we can later retrieve "similar behavior profiles"
 * for a given user.
 *
 * Vector payload schema:
 *   userId:          string
 *   listingId:       string
 *   eventType:       VIEW | CLICK | BOOKMARK | SEARCH | INQUIRY | SHARE
 *   durationSeconds: number | null
 *   metadata:        object | null
 *   timestamp:       ISO string
 */
@Injectable()
export class UserBehaviorVectorService implements OnModuleInit {
  private readonly logger = new Logger(UserBehaviorVectorService.name);

  private qdrantClient: QdrantClient;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private readonly collectionName: string;

  /** Weights for computing a weighted behavior text for embedding */
  private static readonly EVENT_WEIGHTS: Record<string, number> = {
    BOOKMARK: 5,
    INQUIRY: 4,
    SHARE: 3,
    CLICK: 2,
    VIEW: 1,
    SEARCH: 1,
  };

  constructor(private configService: ConfigService) {
    this.collectionName = this.configService.get<string>(
      'QDRANT_BEHAVIOR_COLLECTION',
      'user_behavior',
    );

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.configService.get<string>('GOOGLE_API_KEY'),
      model: 'gemini-embedding-001',
    });
  }

  async onModuleInit() {
    const qdrantUrl = this.configService.get<string>(
      'QDRANT_URL',
      'http://localhost:6333',
    );
    const qdrantApiKey = this.configService.get<string>('QDRANT_API_KEY');

    this.logger.log(
      `Initializing Qdrant client for collection "${this.collectionName}" at ${qdrantUrl}`,
    );

    this.qdrantClient = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey || undefined,
    });

    await this.ensureCollection();
  }

  // ─── Public API ────────────────────────────────────────────────

  /**
   * Ingest an array of behavior events for a user.
   * Each event is embedded and upserted as a point in Qdrant.
   */
  async ingestBehavior(
    userId: string,
    events: BehaviorEventDto[],
  ): Promise<number> {
    if (!this.qdrantClient) {
      this.logger.warn('Qdrant client not initialized – skipping ingest');
      return 0;
    }

    const points: Array<{
      id: string;
      vector: number[];
      payload: Record<string, unknown>;
    }> = [];

    for (const event of events) {
      const textToEmbed = this.buildEmbeddingText(userId, event);
      const [vector] = await this.embeddings.embedDocuments([textToEmbed]);

      const pointId = this.generatePointId();
      points.push({
        id: pointId,
        vector,
        payload: {
          userId,
          listingId: event.listingId,
          eventType: event.eventType,
          durationSeconds: event.durationSeconds ?? null,
          metadata: event.metadata ?? null,
          timestamp: new Date().toISOString(),
          embeddingText: textToEmbed,
        },
      });
    }

    await this.qdrantClient.upsert(this.collectionName, {
      wait: true,
      points,
    });

    this.logger.log(
      `Ingested ${points.length} behavior events for user ${userId}`,
    );
    return points.length;
  }

  /**
   * Retrieve the N most recent behavior events for a user from Qdrant
   * using scroll + filter.
   */
  async getUserBehaviorHistory(
    userId: string,
    limit: number = 50,
  ): Promise<
    Array<{
      listingId: string;
      eventType: string;
      durationSeconds: number | null;
      timestamp: string;
    }>
  > {
    if (!this.qdrantClient) return [];

    try {
      const result = await this.qdrantClient.scroll(this.collectionName, {
        filter: {
          must: [{ key: 'userId', match: { value: userId } }],
        },
        limit,
        with_payload: true,
      });

      return (result.points || []).map((pt) => {
        const p = pt.payload as Record<string, unknown>;
        return {
          listingId: p.listingId as string,
          eventType: p.eventType as string,
          durationSeconds: (p.durationSeconds as number) ?? null,
          timestamp: p.timestamp as string,
        };
      });
    } catch (error) {
      this.logger.error(
        'Failed to retrieve user behavior history',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }

  /**
   * Find users with similar behavior profiles to the given user.
   * We embed a summary of the user's behavior, then do a similarity
   * search across all points – the top hits from *other* users
   * give us a collaborative-filtering signal.
   */
  async findSimilarBehaviorListings(
    behaviorSummary: string,
    userId: string,
    limit: number = 20,
  ): Promise<Array<{ listingId: string; score: number }>> {
    if (!this.qdrantClient) return [];

    try {
      const [queryVector] = await this.embeddings.embedDocuments([
        behaviorSummary,
      ]);

      const results = await this.qdrantClient.search(this.collectionName, {
        vector: queryVector,
        limit,
        filter: {
          must_not: [{ key: 'userId', match: { value: userId } }],
        },
        with_payload: true,
      });

      // De-duplicate by listingId, keeping highest score
      const listingScores = new Map<string, number>();
      for (const hit of results) {
        const listingId = (hit.payload as Record<string, unknown>)
          .listingId as string;
        const existing = listingScores.get(listingId) ?? 0;
        if (hit.score > existing) {
          listingScores.set(listingId, hit.score);
        }
      }

      return Array.from(listingScores.entries())
        .map(([listingId, score]) => ({ listingId, score }))
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.error(
        'Failed to find similar behavior listings',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }

  // ─── Internals ─────────────────────────────────────────────────

  private async ensureCollection() {
    try {
      const collections = await this.qdrantClient.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName,
      );

      if (!exists) {
        this.logger.log(
          `Collection "${this.collectionName}" not found – creating…`,
        );
        // Gemini embedding-001 outputs 3072-dimensional vectors (updated in 2025)
        // Can be scaled down to 768 or 1536 using output_dimensionality parameter
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: { size: 3072, distance: 'Cosine' },
        });
        // Create payload indexes for fast filtering
        await this.qdrantClient.createPayloadIndex(this.collectionName, {
          field_name: 'userId',
          field_schema: 'keyword',
        });
        await this.qdrantClient.createPayloadIndex(this.collectionName, {
          field_name: 'listingId',
          field_schema: 'keyword',
        });
        await this.qdrantClient.createPayloadIndex(this.collectionName, {
          field_name: 'eventType',
          field_schema: 'keyword',
        });
        this.logger.log(
          `Collection "${this.collectionName}" created with indexes.`,
        );
      } else {
        this.logger.log(`Collection "${this.collectionName}" already exists.`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ensure Qdrant collection "${this.collectionName}"`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Build a natural-language string that captures the event semantics.
   * This is what gets embedded as a vector.
   */
  private buildEmbeddingText(userId: string, event: BehaviorEventDto): string {
    const weight =
      UserBehaviorVectorService.EVENT_WEIGHTS[event.eventType] ?? 1;
    const durationInfo = event.durationSeconds
      ? ` for ${event.durationSeconds} seconds`
      : '';
    const metaInfo = event.metadata
      ? ` context: ${JSON.stringify(event.metadata)}`
      : '';

    return (
      `User ${userId} performed ${event.eventType} (weight=${weight}) ` +
      `on listing ${event.listingId}${durationInfo}.${metaInfo}`
    );
  }

  /** UUID v4 generator (no external dep needed) */
  private generatePointId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}

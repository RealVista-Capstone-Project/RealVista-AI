import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Pool } from 'pg';
import { UserBehaviorVectorService } from './user-behavior-vector.service';
import type {
  RecommendationResponse,
  RecommendedListing,
  IngestResponse,
} from '../dto/recommendation-response.dto';
import type { BehaviorEventDto } from '../dto/user-behavior.dto';

/**
 * Core recommendation logic:
 *
 * 1. Ingest PostHog behavior events → embed & store in Qdrant
 * 2. Generate recommendations by:
 *    a) Building a behavior summary from the user's history in Qdrant
 *    b) Finding similar-behavior listings from other users (collaborative filtering)
 *    c) Sending the behavior summary + candidate listings to Gemini LLM
 *    d) LLM returns a ranked list of listing IDs with reasons
 */
@Injectable()
export class RecommendationService implements OnModuleDestroy {
  private readonly logger = new Logger(RecommendationService.name);
  private readonly llm: ChatGoogleGenerativeAI;
  private readonly pgPool: Pool;

  /** Event type weights for building behavior summaries */
  private static readonly EVENT_WEIGHTS: Record<string, number> = {
    BOOKMARK: 5,
    INQUIRY: 4,
    SHARE: 3,
    CLICK: 2,
    VIEW: 1,
    SEARCH: 1,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly behaviorVectorService: UserBehaviorVectorService,
  ) {
    this.llm = new ChatGoogleGenerativeAI({
      model: 'gemini-3.1-flash-lite-preview',
      temperature: 0.3,
      apiKey: this.configService.get<string>('GOOGLE_API_KEY'),
    });

    this.pgPool = new Pool({
      host: this.configService.get<string>('DB_HOST') || 'localhost',
      port: this.configService.get<number>('DB_PORT') || 5432,
      database: this.configService.get<string>('DB_NAME') || 'realvista_test',
      user: this.configService.get<string>('DB_USER') || 'postgres',
      password: this.configService.get<string>('DB_PASSWORD') || 'postgres',
    });
  }

  async onModuleDestroy() {
    await this.pgPool.end();
  }

  // ─── Public API ────────────────────────────────────────────────

  /**
   * Ingest behavior events from PostHog (forwarded by the backend).
   */
  async ingestBehavior(
    userId: string,
    events: BehaviorEventDto[],
  ): Promise<IngestResponse> {
    this.logger.log(
      `Ingesting ${events.length} behavior events for user ${userId}`,
    );

    const ingested = await this.behaviorVectorService.ingestBehavior(
      userId,
      events,
    );

    return {
      success: ingested > 0,
      eventsIngested: ingested,
      message:
        ingested > 0
          ? `Successfully stored ${ingested} behavior events in vector DB`
          : 'No events were ingested (Qdrant may be unavailable)',
    };
  }

  /**
   * Generate personalized recommendations for a user.
   *
   * Flow:
   *  1. Pull the user's behavior history from Qdrant
   *  2. Build a weighted behavior summary string
   *  3. Use the summary to find similar-behavior listings (collaborative filtering)
   *  4. Send summary + candidate listing IDs to Gemini for ranking + reasoning
   *  5. Return the ranked listing IDs with AI-generated reasons
   */
  /**
   * Generate personalized recommendations for a user.
   */
  async getRecommendations(
    userId: string,
    limit: number = 10,
    listingType?: 'SALE' | 'RENT',
  ): Promise<RecommendationResponse> {
    this.logger.log(
      `Generating recommendations for user ${userId} (listingType=${listingType ?? 'any'})`,
    );

    // 1. Retrieve behavior history from Qdrant
    const behaviorHistory =
      await this.behaviorVectorService.getUserBehaviorHistory(userId, 100);

    if (behaviorHistory.length === 0) {
      this.logger.warn(
        `No behavior history in Qdrant for user ${userId} (listingType=${listingType ?? 'any'})`,
      );
      // Vẫn có thể gợi ý theo loại tin từ PostgreSQL (cold start) — tránh tab Thuê/Mua trống khi Qdrant rỗng / ingest lỗi.
      if (listingType) {
        return this.coldStartFromPublished(userId, limit, listingType);
      }
      return {
        userId,
        recommendations: [],
        generatedAt: new Date().toISOString(),
        behaviorSummary: 'No behavior data available',
      };
    }

    // 2. Fetch interacted listings full details from PostgreSQL
    const interactedIds = Array.from(
      new Set(behaviorHistory.map((b) => b.listingId)),
    );
    const interactedParams: unknown[] = [interactedIds];
    let interactedSql = `
      SELECT l.*, p.*, pt.name as property_type_name
      FROM listings l
      JOIN properties p ON l.property_id = p.property_id
      JOIN property_types pt ON p.property_type_id = pt.property_type_id
      WHERE l.listing_id = ANY($1::uuid[])
    `;
    if (listingType) {
      interactedParams.push(listingType);
      interactedSql += ` AND l.listing_type = $${interactedParams.length}`;
    }
    const { rows: interactedRows } = await this.pgPool.query(
      interactedSql,
      interactedParams,
    );

    const interactedContext = this.buildInteractedContext(
      behaviorHistory,
      interactedRows,
    );
    const behaviorSummary = this.buildBehaviorSummary(behaviorHistory);

    // 3. Find similar users behavior (Collaborative signal)
    const collaborativeListings =
      await this.behaviorVectorService.findSimilarBehaviorListings(
        behaviorSummary,
        userId,
        10,
      );

    // 4. Smart Candidate Fetch (Max 20 Candidates to prioritize performance & AI context window)
    const candidates = await this.getCandidateListings(
      interactedRows,
      collaborativeListings.map((c) => c.listingId),
      20,
      listingType,
    );

    const candidateContext = candidates
      .map((c) => this.formatListingForLLM(c))
      .join('\n');

    // 5. Ask Gemini to evaluate features and rank
    const prompt = `You are a real estate recommendation engine for the RealVista platform.

Here are the listings the user has interacted with most (along with their engagement score):
${interactedContext}

Evaluate what the user is looking for based on the TYPE, PRICE, AMENITIES, and FEATURES of their interacted listings.

Below are candidate listings fetched from our database:
${candidateContext}

=== INSTRUCTIONS ===
1. Analyze the user's preferences from their highly engaged listings above.
2. Select and rank the TOP ${limit} most relevant candidate listings for this user.
3. For each recommendation, provide a brief human-readable reason (1-2 sentences) why it matches their preferences (e.g. price, amenities).
4. Return EXACTLY a JSON array (no markdown, no code fences) with this structure:
[
  {
    "listingId": "<uuid>",
    "reason": "<explanation>",
    "score": <0.0 to 1.0>
  }
]
5. Return at most ${limit} items, sorted by score descending.
6. ONLY return the JSON array, nothing else.`;

    const recommendations = await this.parseLLMResponse(
      prompt,
      userId,
      candidates.map((c) => c.listing_id),
      limit,
    );

    // 6. Map rich DB row data back to the recommendations response
    const listingDataMap = new Map<string, Record<string, unknown>>();
    for (const row of [...candidates, ...interactedRows]) {
      listingDataMap.set(
        String(row.listing_id),
        row as Record<string, unknown>,
      );
    }

    const enrichedRecommendations = recommendations.map((r) => ({
      ...r,
      listingData: listingDataMap.get(r.listingId),
    }));

    return {
      userId,
      recommendations: enrichedRecommendations,
      generatedAt: new Date().toISOString(),
      behaviorSummary,
    };
  }

  // ─── Internals ─────────────────────────────────────────────────

  /**
   * Khi chưa có vector hành vi: trả tin PUBLISHED mới nhất đúng SALE|RENT để widget không bị 0 kết quả.
   */
  private async coldStartFromPublished(
    userId: string,
    limit: number,
    listingType: 'SALE' | 'RENT',
  ): Promise<RecommendationResponse> {
    const sql = `
      SELECT l.*, p.*, pt.name as property_type_name
      FROM listings l
      JOIN properties p ON l.property_id = p.property_id
      JOIN property_types pt ON p.property_type_id = pt.property_type_id
      WHERE l.status = 'PUBLISHED' AND l.listing_type = $1
      ORDER BY l.published_at DESC NULLS LAST
      LIMIT $2
    `;
    try {
      const { rows } = await this.pgPool.query(sql, [listingType, limit]);
      const recommendations: RecommendedListing[] = rows.map((row, idx) => ({
        listingId: String(row.listing_id),
        reason:
          'Tin đăng mới — gợi ý khởi đầu khi chưa đủ lịch sử tương tác cá nhân.',
        score: Math.max(0.55, 1 - idx * 0.07),
        listingData: row as Record<string, unknown>,
      }));
      this.logger.log(
        `Cold start ${listingType}: ${recommendations.length} listings for user ${userId}`,
      );
      return {
        userId,
        recommendations,
        generatedAt: new Date().toISOString(),
        behaviorSummary:
          'Chưa có lịch sử hành vi trong vector DB; hiển thị tin mới nhất theo loại giao dịch.',
      };
    } catch (e) {
      this.logger.error(
        'coldStartFromPublished query failed',
        e instanceof Error ? e.stack : String(e),
      );
      return {
        userId,
        recommendations: [],
        generatedAt: new Date().toISOString(),
        behaviorSummary: 'No behavior data available',
      };
    }
  }

  private async getCandidateListings(
    interactedListings: any[],
    collaborativeIds: string[],
    limit: number,
    listingType?: 'SALE' | 'RENT',
  ): Promise<any[]> {
    const params: any[] = [];
    let query = `
      SELECT l.*, p.*, pt.name as property_type_name
      FROM listings l
      JOIN properties p ON l.property_id = p.property_id
      JOIN property_types pt ON p.property_type_id = pt.property_type_id
      WHERE l.status = 'PUBLISHED'
    `;
    if (listingType) {
      params.push(listingType);
      query += ` AND l.listing_type = $${params.length}`;
    }
    const conditions: string[] = [];

    if (collaborativeIds.length > 0) {
      params.push(collaborativeIds);
      conditions.push(`l.listing_id = ANY($${params.length}::uuid[])`);
    }

    if (interactedListings.length > 0) {
      const prices = interactedListings.map((r) => Number(r.price));
      const minPrice = Math.min(...prices) * 0.7; // ±30% range
      const maxPrice = Math.max(...prices) * 1.3;
      const types = Array.from(
        new Set(interactedListings.map((r) => String(r.property_type_id))),
      );
      const listingTypes = Array.from(
        new Set(interactedListings.map((r) => String(r.listing_type))),
      );

      params.push(minPrice);
      const minPIdx = params.length;
      params.push(maxPrice);
      const maxPIdx = params.length;
      params.push(listingTypes);
      const ltIdx = params.length;
      params.push(types);
      const tIdx = params.length;

      conditions.push(
        `(l.price BETWEEN $${minPIdx} AND $${maxPIdx} AND l.listing_type = ANY($${ltIdx}) AND p.property_type_id = ANY($${tIdx}::uuid[]))`,
      );
    }

    if (conditions.length > 0) {
      query += ` AND (${conditions.join(' OR ')})`;
    }

    query += ` LIMIT ${limit}`;

    try {
      const { rows } = await this.pgPool.query(query, params);
      return rows;
    } catch (e) {
      this.logger.error(
        'Error fetching candidates from PostgreSQL',
        e instanceof Error ? e.stack : String(e),
      );
      return [];
    }
  }

  private buildInteractedContext(history: Array<any>, rows: any[]): string {
    const rowMap = new Map();
    for (const r of rows) rowMap.set(String(r.listing_id), r);

    const listingWeights = new Map<string, number>();
    for (const h of history) {
      const w = RecommendationService.EVENT_WEIGHTS[h.eventType] ?? 1;
      listingWeights.set(
        h.listingId,
        (listingWeights.get(h.listingId) ?? 0) + w,
      );
    }

    const sortedIds = Array.from(listingWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(0, 5); // Pick top 5 most engaged

    return sortedIds
      .map((id) => {
        const row = rowMap.get(id);
        if (!row) return '';
        return `[Engagement: ${listingWeights.get(id)}] ${this.formatListingForLLM(row)}`;
      })
      .filter((s) => s)
      .join('\n');
  }

  private formatListingForLLM(row: any): string {
    return JSON.stringify({
      listingId: row.listing_id,
      transactionType: row.listing_type,
      propertyType: row.property_type_name,
      price: Number(row.price),
      address: row.street_address,
      attributes: row.extra_attributes,
      description: row.descriptions
        ? String(row.descriptions).substring(0, 200) + '...'
        : '',
    });
  }

  private buildBehaviorSummary(
    history: Array<{
      listingId: string;
      eventType: string;
      durationSeconds: number | null;
      timestamp: string;
    }>,
  ): string {
    const listingEvents = new Map<
      string,
      { events: string[]; totalWeight: number; totalDuration: number }
    >();

    for (const event of history) {
      const weight = RecommendationService.EVENT_WEIGHTS[event.eventType] ?? 1;
      const existing = listingEvents.get(event.listingId) ?? {
        events: [],
        totalWeight: 0,
        totalDuration: 0,
      };
      existing.events.push(event.eventType);
      existing.totalWeight += weight;
      existing.totalDuration += event.durationSeconds ?? 0;
      listingEvents.set(event.listingId, existing);
    }

    const sorted = Array.from(listingEvents.entries()).sort(
      (a, b) => b[1].totalWeight - a[1].totalWeight,
    );

    const lines = sorted.slice(0, 15).map(([listingId, data]) => {
      const eventCounts = data.events.reduce(
        (acc, e) => {
          acc[e] = (acc[e] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      const eventStr = Object.entries(eventCounts)
        .map(([type, count]) => `${type}:${count}`)
        .join(', ');
      const duration =
        data.totalDuration > 0 ? `, total time: ${data.totalDuration}s` : '';
      return `- Listing ${listingId}: [${eventStr}] engagement=${data.totalWeight}${duration}`;
    });

    return (
      `User behavior summary (${history.length} total events across ${listingEvents.size} listings):\n` +
      lines.join('\n')
    );
  }

  private async parseLLMResponse(
    prompt: string,
    userId: string,
    fallbackIds: string[],
    limit: number,
  ): Promise<RecommendedListing[]> {
    if (fallbackIds.length === 0) return [];

    try {
      const response = await this.llm.invoke(prompt);
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      const cleaned = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed = JSON.parse(cleaned) as RecommendedListing[];

      return parsed
        .filter(
          (item) =>
            item.listingId &&
            typeof item.reason === 'string' &&
            typeof item.score === 'number',
        )
        .slice(0, limit)
        .map((item) => ({
          listingId: item.listingId,
          reason: item.reason,
          score: Math.max(0, Math.min(1, item.score)),
        }));
    } catch (error) {
      this.logger.error(
        `LLM ranking failed for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );

      return fallbackIds.slice(0, limit).map((id, idx) => ({
        listingId: id,
        reason:
          'Recommended based on similar attributes to your historical preferences.',
        score: Math.max(0.1, 1 - idx * 0.1),
      }));
    }
  }
}

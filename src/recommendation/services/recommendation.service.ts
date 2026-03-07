import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
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
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private readonly llm: ChatGoogleGenerativeAI;

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
  async getRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<RecommendationResponse> {
    this.logger.log(`Generating recommendations for user ${userId}`);

    // 1. Retrieve behavior history from Qdrant
    const behaviorHistory =
      await this.behaviorVectorService.getUserBehaviorHistory(userId, 100);

    if (behaviorHistory.length === 0) {
      this.logger.warn(`No behavior history found for user ${userId}`);
      return {
        userId,
        recommendations: [],
        generatedAt: new Date().toISOString(),
        behaviorSummary: 'No behavior data available',
      };
    }

    // 2. Build weighted behavior summary
    const behaviorSummary = this.buildBehaviorSummary(behaviorHistory);
    this.logger.debug(`Behavior summary: ${behaviorSummary}`);

    // 3. Find similar-behavior listings from other users (collaborative signal)
    const collaborativeListings =
      await this.behaviorVectorService.findSimilarBehaviorListings(
        behaviorSummary,
        userId,
        limit * 3, // fetch more candidates than needed so LLM can rank
      );

    // 4. Merge the user's own most-interacted listings + collaborative candidates
    const candidateListingIds = this.mergeCandidates(
      behaviorHistory,
      collaborativeListings,
      limit * 2,
    );

    // 5. Ask Gemini to rank and explain
    const recommendations = await this.rankWithLLM(
      userId,
      behaviorSummary,
      candidateListingIds,
      limit,
    );

    return {
      userId,
      recommendations,
      generatedAt: new Date().toISOString(),
      behaviorSummary,
    };
  }

  // ─── Internals ─────────────────────────────────────────────────

  /**
   * Build a natural-language summary of the user's behavior for
   * the LLM prompt. Groups by listing and weighs event types.
   */
  private buildBehaviorSummary(
    history: Array<{
      listingId: string;
      eventType: string;
      durationSeconds: number | null;
      timestamp: string;
    }>,
  ): string {
    // Group events by listing
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

    // Sort by total weight (most engaged first)
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

  /**
   * Merge the user's own heavily-interacted listings with
   * collaborative-filtering candidates (other users' listings).
   * Returns unique listing IDs.
   */
  private mergeCandidates(
    ownHistory: Array<{ listingId: string; eventType: string }>,
    collaborativeListings: Array<{ listingId: string; score: number }>,
    maxCandidates: number,
  ): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    // Add collaborative candidates first (they are NEW to this user)
    for (const cl of collaborativeListings) {
      if (!seen.has(cl.listingId)) {
        seen.add(cl.listingId);
        result.push(cl.listingId);
      }
    }

    // Add user's own top listings (for "more like this" recommendations)
    const ownListingCounts = new Map<string, number>();
    for (const h of ownHistory) {
      const w = RecommendationService.EVENT_WEIGHTS[h.eventType] ?? 1;
      ownListingCounts.set(
        h.listingId,
        (ownListingCounts.get(h.listingId) ?? 0) + w,
      );
    }
    const sortedOwn = Array.from(ownListingCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    for (const id of sortedOwn) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }

    return result.slice(0, maxCandidates);
  }

  /**
   * Ask Gemini to rank the candidate listings and provide reasons.
   * The prompt includes the behavior summary and candidate listing IDs.
   * Returns a structured array of { listingId, reason, score }.
   */
  private async rankWithLLM(
    userId: string,
    behaviorSummary: string,
    candidateListingIds: string[],
    limit: number,
  ): Promise<RecommendedListing[]> {
    if (candidateListingIds.length === 0) {
      return [];
    }

    const prompt = `You are a real estate recommendation engine for the RealVista platform.

Given the following user behavior data and candidate listing IDs, rank the TOP ${limit} most relevant listings for this user and explain WHY each listing is recommended.

=== USER BEHAVIOR ===
${behaviorSummary}

=== CANDIDATE LISTING IDS ===
${candidateListingIds.join('\n')}

=== INSTRUCTIONS ===
1. Analyze the user's behavior patterns (what types of listings they view, click, bookmark most).
2. Rank the candidate listings by predicted relevance to this user.
3. For each recommendation, provide a brief human-readable reason.
4. Return EXACTLY a JSON array (no markdown, no code fences) with this structure:
[
  {
    "listingId": "<uuid>",
    "reason": "<1-2 sentence explanation>",
    "score": <0.0 to 1.0>
  }
]
5. Return at most ${limit} items, sorted by score descending.
6. ONLY return the JSON array, nothing else.`;

    try {
      const response = await this.llm.invoke(prompt);
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      // Strip markdown code fences if the model wraps them
      const cleaned = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed = JSON.parse(cleaned) as RecommendedListing[];

      // Validate and sanitize
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

      // Fallback: return candidates with generic reasons
      return candidateListingIds.slice(0, limit).map((id, idx) => ({
        listingId: id,
        reason: 'Recommended based on similar user behavior patterns',
        score: Math.max(0.1, 1 - idx * 0.1),
      }));
    }
  }
}

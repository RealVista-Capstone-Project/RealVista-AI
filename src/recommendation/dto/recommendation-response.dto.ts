export interface RecommendedListing {
  /** Listing ID (UUID) from the backend database */
  listingId: string;

  /** AI-generated reason for recommending this listing */
  reason: string;

  /** Relevance score (0.0 - 1.0) */
  score: number;
}

export interface RecommendationResponse {
  /** User ID the recommendations are for */
  userId: string;

  /** List of recommended listing IDs with reasons */
  recommendations: RecommendedListing[];

  /** ISO timestamp of when the recommendations were generated */
  generatedAt: string;

  /** The behavior summary that was used to generate recommendations */
  behaviorSummary: string;
}

export interface IngestResponse {
  /** Whether the behavior was successfully stored */
  success: boolean;

  /** Number of events ingested */
  eventsIngested: number;

  /** Message for the caller */
  message: string;
}

import { BaseMessage } from '@langchain/core/messages';

/**
 * Define the State for the Image Quality Analysis LangGraph Workflow.
 */
export interface ImageAnalysisState {
  // Analysis history or intermediate agent thoughts
  messages: BaseMessage[];

  // Image data (Base64) to be sent to Vision LLM
  imageBuffer?: Buffer;

  // Metadata from Spring Boot
  listingId?: string;
  imageUrl?: string;

  // Analysis result components
  analysis?: {
    isValidProperty?: boolean;
    lightingScore?: number;
    compositionScore?: number;
    clarityScore?: number;
    listingRelevance?: string; // e.g. "Bedroom", "Kitchen", "Exterior"
    feedback?: string;
  };

  // Final aggregated score (0-100)
  finalScore?: number;

  // Current step in the graph
  currentStep?: string;
}

/**
 * Define the State for the Listing Content Verification LangGraph Workflow.
 */
export interface ListingVerificationState {
  // Content to verify
  title: string;
  description: string;
  listingId?: string;

  // Analysis result
  analysis?: {
    isValid: boolean;
    safetyScore: number; // 0-100 (absence of toxicity, NSFW, etc.)
    professionalismScore: number; // 0-100
    clarityScore: number; // 0-100
    identifiedFeatures: string[];
    feedback: string;
  };

  currentStep?: string;
}

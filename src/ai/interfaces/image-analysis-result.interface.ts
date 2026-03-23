export interface ImageAnalysisResult {
  analysis?: {
    isValidProperty?: boolean;
    lightingScore: number;
    compositionScore: number;
    clarityScore: number;
    listingRelevance: string;
    feedback: string;
  };
  finalScore: number;
  currentStep: string;
  listingId: string;
  imageUrl: string;
}

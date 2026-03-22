export interface BulkImageIndividualResult {
  imageIndex: number;
  isValidProperty: boolean;
  lightingScore: number;
  compositionScore: number;
  clarityScore: number;
  listingRelevance: string;
  feedback: string;
  finalScore: number;
}

export interface BulkImageCollectionAnalysis {
  hasVariety: boolean;
  duplicatesDetected: boolean;
  missingAreas: string[];
  overallScore: number;
  suggestion: string;
}

export interface BulkImageAnalysisResult {
  individualResults: BulkImageIndividualResult[];
  collectionAnalysis: BulkImageCollectionAnalysis;
  currentStep: string;
  listingId: string;
}

export interface ListingVerificationResult {
  isValid: boolean;
  safetyScore: number;
  professionalismScore: number;
  clarityScore: number;
  identifiedFeatures: string[];
  feedback: string;
  currentStep: string;
}

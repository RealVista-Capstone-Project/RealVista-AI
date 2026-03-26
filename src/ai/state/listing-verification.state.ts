import { Annotation } from '@langchain/langgraph';

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

export const ListingVerificationAnnotation = Annotation.Root({
  title: Annotation<string>({
    reducer: (_x: string, y: string) => y,
    default: () => '',
  }),
  description: Annotation<string>({
    reducer: (_x: string, y: string) => y,
    default: () => '',
  }),
  listingId: Annotation<string | undefined>({
    reducer: (_x: string | undefined, y: string | undefined) => y,
    default: () => undefined,
  }),
  analysis: Annotation<NonNullable<ListingVerificationState['analysis']>>({
    reducer: (
      x: NonNullable<ListingVerificationState['analysis']>,
      y: NonNullable<ListingVerificationState['analysis']>,
    ) => ({ ...x, ...y }),
    default: (): NonNullable<ListingVerificationState['analysis']> => ({
      isValid: true,
      safetyScore: 0,
      professionalismScore: 0,
      clarityScore: 0,
      identifiedFeatures: [],
      feedback: '',
    }),
  }),
  currentStep: Annotation<string>({
    reducer: (_x: string, y: string) => y,
    default: () => 'init',
  }),
});

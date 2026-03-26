import { Annotation } from '@langchain/langgraph';
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

export const ImageAnalysisAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  }),
  imageBuffer: Annotation<Buffer | undefined>({
    reducer: (_x: Buffer | undefined, y: Buffer | undefined) => y,
    default: () => undefined,
  }),
  listingId: Annotation<string | undefined>({
    reducer: (_x: string | undefined, y: string | undefined) => y,
    default: () => undefined,
  }),
  imageUrl: Annotation<string | undefined>({
    reducer: (_x: string | undefined, y: string | undefined) => y,
    default: () => undefined,
  }),
  analysis: Annotation<NonNullable<ImageAnalysisState['analysis']>>({
    reducer: (
      x: NonNullable<ImageAnalysisState['analysis']>,
      y: NonNullable<ImageAnalysisState['analysis']>,
    ) => ({ ...x, ...y }),
    default: (): NonNullable<ImageAnalysisState['analysis']> => ({
      isValidProperty: true,
      lightingScore: 0,
      compositionScore: 0,
      clarityScore: 0,
      listingRelevance: '',
      feedback: '',
    }),
  }),
  finalScore: Annotation<number>({
    reducer: (_x: number, y: number) => y,
    default: () => 0,
  }),
  currentStep: Annotation<string>({
    reducer: (_x: string, y: string) => y,
    default: () => 'init',
  }),
});

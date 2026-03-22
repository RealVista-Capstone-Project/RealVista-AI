import { Annotation } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type {
  BulkImageIndividualResult,
  BulkImageCollectionAnalysis,
} from '../interfaces';

/**
 * Define the State for the Bulk Image Quality Analysis LangGraph Workflow.
 */
export interface BulkImageAnalysisState {
  // Analysis history or intermediate agent thoughts
  messages: BaseMessage[];

  // Array of image buffers to be sent to Vision LLM
  imageBuffers: Buffer[];

  // Original file names for each image
  imageNames: string[];

  // Metadata from Spring Boot
  listingId?: string;

  // Per-image analysis results from vision node
  individualResults?: BulkImageIndividualResult[];

  // Collection-level analysis
  collectionAnalysis?: BulkImageCollectionAnalysis;

  // Current step in the graph
  currentStep?: string;
}

export const BulkImageAnalysisAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  }),
  imageBuffers: Annotation<Buffer[]>({
    reducer: (_x: Buffer[], y: Buffer[]) => y,
    default: () => [],
  }),
  imageNames: Annotation<string[]>({
    reducer: (_x: string[], y: string[]) => y,
    default: () => [],
  }),
  listingId: Annotation<string | undefined>({
    reducer: (_x: string | undefined, y: string | undefined) => y,
    default: () => undefined,
  }),
  individualResults: Annotation<BulkImageIndividualResult[]>({
    reducer: (
      _x: BulkImageIndividualResult[],
      y: BulkImageIndividualResult[],
    ) => y,
    default: () => [],
  }),
  collectionAnalysis: Annotation<
    NonNullable<BulkImageAnalysisState['collectionAnalysis']>
  >({
    reducer: (
      x: NonNullable<BulkImageAnalysisState['collectionAnalysis']>,
      y: NonNullable<BulkImageAnalysisState['collectionAnalysis']>,
    ) => ({ ...x, ...y }),
    default: (): NonNullable<BulkImageAnalysisState['collectionAnalysis']> => ({
      hasVariety: false,
      duplicatesDetected: false,
      missingAreas: [],
      overallScore: 0,
      suggestion: '',
    }),
  }),
  currentStep: Annotation<string>({
    reducer: (_x: string, y: string) => y,
    default: () => 'init',
  }),
});

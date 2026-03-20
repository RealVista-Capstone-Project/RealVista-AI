import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService } from './lang-graph.service';
import { ListingVerificationState } from '../state/listing-verification.state';

export interface ListingVerificationResult {
  isValid: boolean;
  safetyScore: number;
  professionalismScore: number;
  clarityScore: number;
  identifiedFeatures: string[];
  feedback: string;
  currentStep: string;
}

@Injectable()
export class ListingVerificationService {
  private readonly logger = new Logger(ListingVerificationService.name);

  constructor(private readonly langGraphService: LangGraphService) {}

  async verifyListing(
    title: string,
    description: string,
    listingId?: string,
  ): Promise<ListingVerificationResult> {
    this.logger.log(`Verifying listing content: ${title}`);

    const workflow = this.langGraphService.createListingVerificationWorkflow();

    const initialState: Partial<ListingVerificationState> = {
      title,
      description,
      listingId,
    };

    const result = (await workflow.invoke(
      initialState as never,
    )) as ListingVerificationState;

    return {
      isValid: result.analysis?.isValid ?? false,
      safetyScore: result.analysis?.safetyScore ?? 0,
      professionalismScore: result.analysis?.professionalismScore ?? 0,
      clarityScore: result.analysis?.clarityScore ?? 0,
      identifiedFeatures: result.analysis?.identifiedFeatures ?? [],
      feedback: result.analysis?.feedback ?? '',
      currentStep: result.currentStep ?? 'unknown',
    };
  }

  async *verifyListingStream(
    title: string,
    description: string,
    listingId?: string,
  ): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
    this.logger.log(`[Stream] Verifying listing content: ${title}`);

    const workflow = this.langGraphService.createListingVerificationWorkflow();

    yield {
      event: 'start',
      data: {
        message: 'Listing verification started',
        title,
        listingId,
      },
    };

    const stream = await workflow.stream({
      title,
      description,
      listingId,
    } as never);

    for await (const chunk of stream) {
      for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
        const output = nodeOutput as Record<string, unknown>;

        if (nodeName === 'verify' && output.analysis) {
          const analysis = output.analysis as Record<string, unknown>;
          yield {
            event: 'verification_complete',
            data: {
              step: 'content_verification_completed',
              analysis: {
                isValid: analysis.isValid ?? false,
                safetyScore: analysis.safetyScore ?? 0,
                professionalismScore: analysis.professionalismScore ?? 0,
                clarityScore: analysis.clarityScore ?? 0,
                identifiedFeatures: analysis.identifiedFeatures ?? [],
                feedback: analysis.feedback ?? '',
              },
            },
          };
        }
      }
    }

    yield {
      event: 'done',
      data: { message: 'Verification complete' },
    };
  }
}

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
}

import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService } from './lang-graph.service';
import { ImageAnalysisState } from '../state/image-analysis.state';

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

@Injectable()
export class ImageAnalysisService {
  private readonly logger = new Logger(ImageAnalysisService.name);

  constructor(private readonly langGraphService: LangGraphService) {}

  async analyzeImageQuality(
    fileBuffer: Buffer,
    originalname: string,
    listingId?: string,
  ): Promise<ImageAnalysisResult> {
    this.logger.log(
      `Analyzing image quality for listing: ${listingId || 'manual-upload'}`,
    );

    const workflow = this.langGraphService.createImageAnalysisWorkflow();
    const result = (await workflow.invoke({
      imageBuffer: fileBuffer,
      listingId: listingId || 'manual-upload',
      imageUrl: originalname || 'uploaded-file',
      messages: [],
    })) as ImageAnalysisState;

    const analysis = result.analysis;

    return {
      analysis: analysis
        ? {
            isValidProperty: analysis.isValidProperty,
            lightingScore: analysis.lightingScore ?? 0,
            compositionScore: analysis.compositionScore ?? 0,
            clarityScore: analysis.clarityScore ?? 0,
            listingRelevance: analysis.listingRelevance ?? '',
            feedback: analysis.feedback ?? '',
          }
        : undefined,
      finalScore: result.finalScore ?? 0,
      currentStep: result.currentStep ?? 'unknown',
      listingId: result.listingId ?? listingId ?? 'manual-upload',
      imageUrl: result.imageUrl ?? originalname ?? 'uploaded-file',
    };
  }
}

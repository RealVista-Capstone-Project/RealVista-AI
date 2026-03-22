import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService } from './lang-graph.service';
import { ImageAnalysisState } from '../state/image-analysis.state';
import { ImageAnalysisResult } from '../interfaces';

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

  async *analyzeImageQualityStream(
    fileBuffer: Buffer,
    originalname: string,
    listingId?: string,
  ): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
    this.logger.log(
      `[Stream] Analyzing image quality for listing: ${listingId || 'manual-upload'}`,
    );

    const workflow = this.langGraphService.createImageAnalysisWorkflow();

    yield {
      event: 'start',
      data: {
        message: 'Image analysis started',
        listingId: listingId || 'manual-upload',
        imageUrl: originalname || 'uploaded-file',
      },
    };

    const stream = await workflow.stream({
      imageBuffer: fileBuffer,
      listingId: listingId || 'manual-upload',
      imageUrl: originalname || 'uploaded-file',
      messages: [],
    });

    for await (const chunk of stream) {
      for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
        const output = nodeOutput as Record<string, unknown>;

        if (nodeName === 'vision' && output.analysis) {
          const analysis = output.analysis as Record<string, unknown>;
          yield {
            event: 'vision_complete',
            data: {
              step: 'vision_analysis_completed',
              analysis: {
                isValidProperty: analysis.isValidProperty ?? true,
                lightingScore: analysis.lightingScore ?? 0,
                compositionScore: analysis.compositionScore ?? 0,
                clarityScore: analysis.clarityScore ?? 0,
                listingRelevance: analysis.listingRelevance ?? '',
                feedback: analysis.feedback ?? '',
              },
            },
          };
        }

        if (nodeName === 'aggregator') {
          yield {
            event: 'score_complete',
            data: {
              step: 'scoring_completed',
              finalScore: (output.finalScore as number) ?? 0,
            },
          };
        }
      }
    }

    yield {
      event: 'done',
      data: { message: 'Analysis complete' },
    };
  }
}

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

  async *analyzeBulkImageQualityStream(
    files: { buffer: Buffer; originalname: string }[],
    listingId?: string,
  ): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
    this.logger.log(
      `[Bulk Stream] Analyzing ${files.length} images for listing: ${listingId || 'manual-upload'}`,
    );

    const workflow = this.langGraphService.createBulkImageAnalysisWorkflow();

    yield {
      event: 'start',
      data: {
        message: 'Bulk image analysis started',
        imageCount: files.length,
        listingId: listingId || 'manual-upload',
        imageNames: files.map((f) => f.originalname),
      },
    };

    const stream = await workflow.stream({
      imageBuffers: files.map((f) => f.buffer),
      imageNames: files.map((f) => f.originalname),
      listingId: listingId || 'manual-upload',
      messages: [],
    } as never);

    for await (const chunk of stream) {
      for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
        const output = nodeOutput as Record<string, unknown>;

        if (nodeName === 'bulkVision' && output.individualResults) {
          yield {
            event: 'bulk_vision_complete',
            data: {
              step: 'bulk_vision_analysis_completed',
              individualResults: output.individualResults,
              collectionAnalysis: output.collectionAnalysis,
            },
          };
        }

        if (nodeName === 'bulkAggregator') {
          yield {
            event: 'bulk_score_complete',
            data: {
              step: 'bulk_scoring_completed',
              individualResults: output.individualResults,
            },
          };
        }
      }
    }

    yield {
      event: 'done',
      data: { message: 'Bulk analysis complete' },
    };
  }
}

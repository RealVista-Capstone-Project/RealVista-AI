import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LangGraphService } from './services/lang-graph.service';
import { ImageAnalysisState } from './state/image-analysis.state';
import { ImageUploadDto } from './dto/image-upload.dto';
import { ImageAnalysisResponseDto } from './dto/image-analysis-response.dto';
import { ApiKeyGuard } from '../auth/guards/api-key/api-key.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('ai')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('ai')
export class ImageAnalysisController {
  constructor(private readonly langGraphService: LangGraphService) {}

  @Post('analyze-quality')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Analyze image quality from an uploaded file',
    description:
      'Directly analyzes the quality of an uploaded image using Gemini Vision and returns the result synchronously.',
  })
  @ApiBody({
    description: 'The image file and optional metadata for analysis.',
    type: ImageUploadDto,
  })
  @ApiResponse({
    status: 200,
    description: 'The image has been successfully analyzed.',
    type: ImageAnalysisResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing API Key (x-api-key header).',
  })
  async analyzeQuality(
    @UploadedFile() file: MulterFile,
    @Body('listingId') listingId?: string,
  ) {
    if (!file) {
      return { message: 'No file uploaded' };
    }

    const workflow = this.langGraphService.createImageAnalysisWorkflow();
    const result = (await workflow.invoke({
      imageBuffer: file.buffer,
      listingId: listingId || 'manual-upload',
      imageUrl: file.originalname || 'uploaded-file',
      messages: [],
    })) as ImageAnalysisState;

    return {
      analysis: result.analysis,
      finalScore: result.finalScore,
      currentStep: result.currentStep,
      listingId: result.listingId,
      imageUrl: result.imageUrl,
    };
  }
}

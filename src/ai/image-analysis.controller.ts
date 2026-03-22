import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Res,
  Header,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ImageAnalysisService } from './services/image-analysis.service';
import { ImageUploadDto } from './dto/image-upload.dto';
import { BulkImageUploadDto } from './dto/bulk-image-upload.dto';
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
import type { Response } from 'express';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = /^image\/(jpeg|png|webp|heic|heif)$/;

const fileInterceptorOptions = {
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string },
    callback: (err: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.test(file.mimetype)) {
      return callback(
        new BadRequestException(
          `Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP, HEIC, HEIF`,
        ),
        false,
      );
    }
    callback(null, true);
  },
};

@ApiTags('ai')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('ai')
export class ImageAnalysisController {
  constructor(private readonly imageAnalysisService: ImageAnalysisService) {}

  @Post('analyze-quality')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Analyze image quality from an uploaded file',
    description:
      'Analyzes the quality of an uploaded image using Gemini Vision and returns the result synchronously.',
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
    status: 400,
    description: 'No file uploaded or invalid file type/size.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing API Key (x-api-key header).',
  })
  async analyzeQuality(
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Body('listingId') listingId?: string,
  ): Promise<ImageAnalysisResponseDto> {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Please provide an image file.',
      );
    }

    return this.imageAnalysisService.analyzeImageQuality(
      file.buffer,
      file.originalname,
      listingId,
    );
  }

  @Post('analyze-quality/stream')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Analyze image quality with streaming response (SSE)',
    description:
      'Analyzes image quality using Gemini Vision and streams intermediate results as Server-Sent Events. ' +
      'Each step of the workflow emits an event: `start`, `vision_complete`, `score_complete`, and `done`.',
  })
  @ApiBody({
    description: 'The image file and optional metadata for analysis.',
    type: ImageUploadDto,
  })
  @ApiResponse({
    status: 200,
    description:
      'Streaming SSE response. Each event contains `event:` and `data:` fields in SSE format.',
  })
  @ApiResponse({
    status: 400,
    description: 'No file uploaded or invalid file type/size.',
  })
  async analyzeQualityStream(
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Body('listingId') listingId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Please provide an image file.',
      );
    }

    try {
      const stream = this.imageAnalysisService.analyzeImageQualityStream(
        file.buffer,
        file.originalname,
        listingId,
      );

      for await (const event of stream) {
        res.write(`event: ${event.event}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post('analyze-quality/bulk/stream')
  @UseInterceptors(FilesInterceptor('files', 10, fileInterceptorOptions))
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Analyze multiple images in bulk with streaming response (SSE)',
    description:
      'Analyzes multiple images in a single Gemini Vision call for cost efficiency. ' +
      'Returns per-image quality scores and a collection-level assessment (variety, duplicates, missing areas). ' +
      'Events: `start`, `bulk_vision_complete`, `bulk_score_complete`, `done`.',
  })
  @ApiBody({
    description:
      'Array of image files (max 10) and optional listing ID for bulk analysis.',
    type: BulkImageUploadDto,
  })
  @ApiResponse({
    status: 200,
    description:
      'Streaming SSE response with per-image results and collection analysis.',
  })
  @ApiResponse({
    status: 400,
    description:
      'No files uploaded, too many files, or invalid file type/size.',
  })
  async analyzeQualityBulkStream(
    @UploadedFiles()
    files: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    }[],
    @Body('listingId') listingId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'No files uploaded. Please provide at least one image file.',
      );
    }

    if (files.length > 10) {
      throw new BadRequestException(
        `Too many files (${files.length}). Maximum is 10 images per request.`,
      );
    }

    try {
      const stream = this.imageAnalysisService.analyzeBulkImageQualityStream(
        files.map((f) => ({ buffer: f.buffer, originalname: f.originalname })),
        listingId,
      );

      for await (const event of stream) {
        res.write(`event: ${event.event}\n`);
        res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }
}

import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageAnalysisService } from './services/image-analysis.service';
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = /^image\/(jpeg|png|webp|heic|heif)$/;

@ApiTags('ai')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('ai')
export class ImageAnalysisController {
  constructor(private readonly imageAnalysisService: ImageAnalysisService) {}

  @Post('analyze-quality')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
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
    }),
  )
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
}

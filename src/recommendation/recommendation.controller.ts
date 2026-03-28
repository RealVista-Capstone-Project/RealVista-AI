import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key/api-key.guard';
import { RecommendationService } from './services/recommendation.service';
import {
  IngestBehaviorDto,
  GetRecommendationsDto,
} from './dto/user-behavior.dto';
import { LogRequestInterceptor } from '../common/interceptors/log-request.interceptor';

@ApiTags('recommendation')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@UseInterceptors(LogRequestInterceptor)
@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Post('ingest')
  @ApiOperation({
    summary: 'Ingest user behavior events from PostHog',
    description:
      'Receives user behavior data (views, clicks, bookmarks, etc.) ' +
      'and stores them as vectors in Qdrant for later recommendation generation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Behavior events successfully ingested.',
  })
  @ApiResponse({ status: 401, description: 'Invalid API key.' })
  async ingestBehavior(@Body() dto: IngestBehaviorDto) {
    return this.recommendationService.ingestBehavior(dto.userId, dto.events);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate AI-powered listing recommendations',
    description:
      'Analyzes the user behavior stored in Qdrant, finds similar behavior ' +
      'patterns from other users (collaborative filtering), and uses Gemini LLM ' +
      'to rank and explain recommended listing IDs. The backend then fetches ' +
      'the full listing data from PostgreSQL.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommendations generated successfully.',
  })
  @ApiResponse({ status: 401, description: 'Invalid API key.' })
  async getRecommendations(@Body() dto: GetRecommendationsDto) {
    console.log('GetRecommendationsDto', dto);
    return this.recommendationService.getRecommendations(
      dto.userId,
      dto.limit ?? 10,
      dto.listingType,
    );
  }
}

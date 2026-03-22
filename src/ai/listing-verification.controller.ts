import { Controller, Post, Body, UseGuards, Res, Header } from '@nestjs/common';
import { ListingVerificationService } from './services/listing-verification.service';
import { VerifyListingDto } from './dto/verify-listing.dto';
import { ListingVerificationResponseDto } from './dto/listing-verification-response.dto';
import { ApiKeyGuard } from '../auth/guards/api-key/api-key.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import type { Response } from 'express';

@ApiTags('ai')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('ai')
export class ListingVerificationController {
  constructor(
    private readonly listingVerificationService: ListingVerificationService,
  ) {}

  @Post('verify-listing')
  @ApiOperation({
    summary: 'Verify real estate listing content for safety and quality',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed analysis of the listing content.',
    type: ListingVerificationResponseDto,
  })
  async verifyListing(
    @Body() verifyListingDto: VerifyListingDto,
  ): Promise<ListingVerificationResponseDto> {
    return this.listingVerificationService.verifyListing(
      verifyListingDto.title,
      verifyListingDto.description,
      verifyListingDto.listingId,
    );
  }

  @Post('verify-listing/stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @ApiOperation({
    summary: 'Verify real estate listing content with streaming response (SSE)',
    description:
      'Verifies listing safety and quality using Gemini and streams intermediate results. ' +
      'Events: `start`, `verification_complete`, `done`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Streaming SSE response.',
  })
  async verifyListingStream(
    @Body() verifyListingDto: VerifyListingDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const stream = this.listingVerificationService.verifyListingStream(
        verifyListingDto.title,
        verifyListingDto.description,
        verifyListingDto.listingId,
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

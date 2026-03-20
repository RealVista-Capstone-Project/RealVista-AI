import { Controller, Post, Body, UseGuards } from '@nestjs/common';
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
}

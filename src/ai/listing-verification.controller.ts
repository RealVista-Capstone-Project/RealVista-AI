import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { LangGraphService } from './services/lang-graph.service';
import { VerifyListingDto } from './dto/verify-listing.dto';
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
  private readonly logger = new Logger(ListingVerificationController.name);

  constructor(private readonly langGraphService: LangGraphService) {}

  @Post('verify-listing')
  @ApiOperation({
    summary: 'Verify real estate listing content for safety and quality',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed analysis of the listing content.',
  })
  async verifyListing(@Body() verifyListingDto: VerifyListingDto) {
    this.logger.log(`Verifying listing content: ${verifyListingDto.title}`);

    const workflow = this.langGraphService.createListingVerificationWorkflow();

    const initialState = {
      title: verifyListingDto.title,
      description: verifyListingDto.description,
      listingId: verifyListingDto.listingId,
    };

    const result = await workflow.invoke(initialState as never);

    return result;
  }
}

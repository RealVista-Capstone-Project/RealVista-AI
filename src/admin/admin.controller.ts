import { Controller, Post, UseGuards, Logger, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key/api-key.guard';
import { RagSyncService, SyncResult } from './services/rag-sync.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(ApiKeyGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly ragSyncService: RagSyncService) {}

  @Post('rag/sync-locations')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sync location knowledge into Qdrant RAG',
    description:
      'Fetches all districts and wards from the Spring Boot backend, ' +
      'generates natural-language location documents, and upserts them ' +
      'into the Qdrant vector store. Existing location documents are ' +
      'deleted first (idempotent re-sync). This is a manual trigger — ' +
      'call it once after deployment or when location data changes.',
  })
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiResponse({
    status: 200,
    description: 'Sync completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            category: { type: 'string', example: 'location' },
            documentsUpserted: { type: 'number', example: 63 },
            durationMs: { type: 'number', example: 4520 },
          },
        },
      },
    },
  })
  async syncLocations(): Promise<{ success: boolean; data: SyncResult }> {
    this.logger.log('Location RAG sync triggered');

    const result = await this.ragSyncService.syncLocations();

    this.logger.log(
      `Location sync done: ${result.documentsUpserted} docs in ${result.durationMs}ms`,
    );

    return { success: true, data: result };
  }
}

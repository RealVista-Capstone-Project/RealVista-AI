import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './services/ai.service';
import { LangGraphService } from './services/lang-graph.service';
import { ImageAnalysisService } from './services/image-analysis.service';
import { ListingVerificationService } from './services/listing-verification.service';
import { ToolsService } from './services/tools.service';
import { QdrantService } from './services/qdrant.service';
import { HttpModule } from '@nestjs/axios';
import { ImageAnalysisController } from './image-analysis.controller';
import { ListingVerificationController } from './listing-verification.controller';

@Module({
  imports: [HttpModule],
  controllers: [
    AiController,
    ImageAnalysisController,
    ListingVerificationController,
  ],
  providers: [
    AiService,
    LangGraphService,
    ImageAnalysisService,
    ListingVerificationService,
    ToolsService,
    QdrantService,
  ],
  exports: [AiService],
})
export class AiModule {}

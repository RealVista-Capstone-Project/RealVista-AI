import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './services/ai.service';
import { LangGraphService } from './services/lang-graph.service';
import { ToolsService } from './services/tools.service';
import { QdrantService } from './services/qdrant.service';

@Module({
  controllers: [AiController],
  providers: [AiService, LangGraphService, ToolsService, QdrantService],
  exports: [AiService],
})
export class AiModule {}

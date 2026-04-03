import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { RagSyncService } from './services/rag-sync.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [AdminController],
  providers: [RagSyncService],
})
export class AdminModule {}

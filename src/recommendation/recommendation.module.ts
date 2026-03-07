import { Module } from '@nestjs/common';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './services/recommendation.service';
import { UserBehaviorVectorService } from './services/user-behavior-vector.service';

@Module({
  controllers: [RecommendationController],
  providers: [RecommendationService, UserBehaviorVectorService],
  exports: [RecommendationService],
})
export class RecommendationModule {}

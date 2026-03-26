import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './services/recommendation.service';
import { UserBehaviorVectorService } from './services/user-behavior-vector.service';
import { SnakeToCamelCaseMiddleware } from '../common/middleware/snake-to-camel-case.middleware';

@Module({
  controllers: [RecommendationController],
  providers: [RecommendationService, UserBehaviorVectorService],
  exports: [RecommendationService],
})
export class RecommendationModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SnakeToCamelCaseMiddleware)
      .forRoutes(RecommendationController);
  }
}

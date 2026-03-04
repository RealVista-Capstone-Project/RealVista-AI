import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './guards/api-key/api-key.guard';

@Module({
  providers: [ApiKeyGuard],
  exports: [ApiKeyGuard],
})
export class AuthModule {}

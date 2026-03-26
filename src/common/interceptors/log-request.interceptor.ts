import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class LogRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LogRequestInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.url === '/recommendation/ingest') {
      this.logger.log('=== INGEST REQUEST DEBUG ===');
      this.logger.log(`Body: ${JSON.stringify(request.body, null, 2)}`);
      this.logger.log(`Headers: ${JSON.stringify(request.headers, null, 2)}`);
      this.logger.log('============================');
    }

    return next.handle();
  }
}

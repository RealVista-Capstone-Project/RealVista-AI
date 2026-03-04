import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers['x-api-key'] as string;
    const validApiKey = this.configService.get<string>('SERVICE_API_KEY');

    if (!apiKeyHeader || apiKeyHeader !== validApiKey) {
      this.logger.warn('Invalid or missing API Key');
      throw new UnauthorizedException('Invalid API Key');
    }

    const userId = request.headers['x-user-id'] as string | undefined;
    const userName = request.headers['x-user-name'] as string | undefined;
    const userRoles = request.headers['x-user-roles'] as string | undefined;

    // Set mock user context since the backend has already authenticated the actual user before hitting this microservice
    const reqWithUser = request as Request & { user: any };
    reqWithUser.user = {
      sub: userId || 'system-user-id',
      username: userName || 'System Admin',
      roles: userRoles ? userRoles.split(',') : ['ADMIN'],
    };

    return true;
  }
}

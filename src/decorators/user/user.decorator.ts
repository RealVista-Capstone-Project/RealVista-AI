import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserContext } from '../../ai/interfaces/user-context.interface.js';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest<{ user: UserContext }>();
    return request.user;
  },
);

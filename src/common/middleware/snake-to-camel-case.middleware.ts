import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SnakeToCamelCaseMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      req.body = this.convertKeysToCamelCase(req.body);
    }
    next();
  }

  private convertKeysToCamelCase(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertKeysToCamelCase(item));
    }

    if (
      typeof obj === 'object' &&
      (obj as Record<string, unknown>).constructor === Object
    ) {
      const result: Record<string, unknown> = {};
      const source = obj as Record<string, unknown>;
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          const camelKey = this.toCamelCase(key);
          result[camelKey] = this.convertKeysToCamelCase(source[key]);
        }
      }
      return result;
    }

    return obj;
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_match, letter: string) =>
      letter.toUpperCase(),
    );
  }
}

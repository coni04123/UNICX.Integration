import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditService, AuditAction } from './audit.service';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditMiddleware.name);

  constructor(private auditService: AuditService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const auditService = this.auditService;
    const logger = this.logger;

    // Get user info from request (set by auth guards)
    const user = (req as any).user;

    // Override res.end to capture response
    const originalEnd = res.end.bind(res);
    (res.end as any) = function(chunk?: any, encoding?: any, callback?: any) {
      const duration = Date.now() - startTime;

      // Log the request if user is authenticated
      if (user) {
        const action = mapMethodToAction(req.method);
        const resource = extractResourceFromPath(req.path);
        const resourceId = extractResourceIdFromPath(req.path);

        // Don't log sensitive data
        const sanitizedBody = sanitizeRequestBody(req.body);
        const sanitizedQuery = sanitizeQueryParams(req.query);

        auditService.log(
          user.sub,
          user.email,
          user.tenantId,
          action,
          resource,
          resourceId,
          undefined, // oldValues
          sanitizedBody, // newValues
          req.ip,
          req.get('User-Agent'),
          req.path,
          req.method,
          {
            duration,
            statusCode: res.statusCode,
            query: sanitizedQuery,
          },
        ).catch(error => {
          logger.error('Failed to log audit:', error);
        });
      }

      return originalEnd(chunk, encoding, callback);
    };

    next();
  }
}

function mapMethodToAction(method: string): AuditAction {
  switch (method.toLowerCase()) {
    case 'get':
      return AuditAction.READ;
    case 'post':
      return AuditAction.CREATE;
    case 'put':
    case 'patch':
      return AuditAction.UPDATE;
    case 'delete':
      return AuditAction.DELETE;
    default:
      return AuditAction.READ;
  }
}

function extractResourceFromPath(path: string): string {
  // Extract resource from path like /api/v1/users -> users
  const segments = path.split('/').filter(segment => segment && segment !== 'api' && segment !== 'v1');
  return segments[0] || 'unknown';
}

function extractResourceIdFromPath(path: string): string | undefined {
  // Extract ID from path like /api/v1/users/123 -> 123
  const segments = path.split('/').filter(segment => segment && segment !== 'api' && segment !== 'v1');
  return segments[1] || undefined;
}

function sanitizeRequestBody(body: any): Record<string, any> {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const sanitized = { ...body };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

function sanitizeQueryParams(query: any): Record<string, any> {
  if (!query || typeof query !== 'object') {
    return {};
  }

  const sanitized = { ...query };

  // Remove sensitive query parameters
  const sensitiveFields = ['token', 'secret', 'key'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

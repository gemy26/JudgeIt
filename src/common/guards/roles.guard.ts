import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../decorators';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  private logger: Logger = new Logger(RolesGuard.name, { timestamp: true });
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const handler = context.getHandler();
    const controller = context.getClass();
    const route = `${controller.name}.${handler.name}`;

    const isPublic = this.reflector.getAllAndOverride<Role[]>('isPublic', [
      handler,
      controller,
    ]);

    if (isPublic) {
      this.logger.debug(`[${route}] Public route — skipping role check`);
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      handler,
      controller,
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      this.logger.debug(`[${route}] No roles required — allowing access`);
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req?.user;

    if (!user) {
      this.logger.warn(`[${route}] No user found on request — denying access`);
      throw new UnauthorizedException('User not authenticated');
    }

    const userRoles: Role[] = user.roles ?? [];
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      this.logger.warn(
        `[${route}] Access denied — user ${user.sub ?? user.id} has roles [${userRoles}] but requires one of [${requiredRoles}]`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    this.logger.debug(
      `[${route}] Access granted — user ${user.sub ?? user.id} matched role(s) [${requiredRoles}]`,
    );

    return true;
  }
}

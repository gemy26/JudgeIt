import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class AtGuard extends AuthGuard('jwt') {
  private logger: Logger = new Logger(AtGuard.name, { timestamp: true });
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const handler = context.getHandler();
    const controller = context.getClass();
    const route = `${controller.name}.${handler.name}`;

    const isPublic = this.reflector.getAllAndOverride('isPublic', [
      handler,
      controller,
    ]);

    if (isPublic) {
      this.logger.debug(`[${route}] Public route — skipping JWT validation`);
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const hasToken = !!req.cookies?.Authentication;
    if (!hasToken) {
      this.logger.warn(`[${route}] Missing Authentication cookie`);
    } else {
      this.logger.debug(
        `[${route}] Authentication cookie present — validating JWT`,
      );
    }

    return super.canActivate(context);
  }
}

import { createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';
const logger = new Logger('GetCurrentUserId', { timestamp: true });
export const GetCurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req?.user;

    logger.debug(`Full user object: ${JSON.stringify(user, null, 2)}`);
    logger.debug(`user.sub: ${user?.sub}`);
    logger.debug(`user.id: ${user?.id}`);
    logger.debug(`user.userId: ${user?.userId}`);

    const userId = user?.sub ?? user?.id ?? user?.userId;
    logger.debug(`Resolved userId: ${userId}`);
    if (!userId) {
      logger.warn('userId could not be resolved from request.user');
    }
    return userId;
  },
);

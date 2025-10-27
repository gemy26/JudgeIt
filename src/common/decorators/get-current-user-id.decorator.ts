import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const GetCurrentUserId = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        console.log("GetCurrentUserId Decorator =>")
        const request = ctx.switchToHttp().getRequest();
        const userId = request.user.sub;
        return userId;
    }
)
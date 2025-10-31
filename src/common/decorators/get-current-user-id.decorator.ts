import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const GetCurrentUserId = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        console.log("GetCurrentUserId Decorator =>")
        const request = ctx.switchToHttp().getRequest();
        console.log(request?.user);
        console.log('Request user:', request.user);
        const userId = request.user.sub;
        return userId;
    }
)
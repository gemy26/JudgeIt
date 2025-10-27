import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const GetCurrentUser = createParamDecorator(
    (data: string | undefined, ctx: ExecutionContext) => {
        console.log('GetCurrentUser Decorator =>', data)
        const request = ctx.switchToHttp().getRequest();
        const user = request?.user;

        console.log(user);
        
        return data ? user?.[data] : user;
    }
)
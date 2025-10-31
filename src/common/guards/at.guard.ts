import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { Observable } from "rxjs";
import { SKIP_KEY } from "../decorators";

@Injectable()
export class AtGuard extends AuthGuard('jwt'){
    constructor(private reflector: Reflector){
        super();
    }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const isPublic = this.reflector.getAllAndOverride('isPublic', [
            context.getHandler(),
            context.getClass()
        ]);

        const skipAuth = this.reflector.getAllAndOverride(SKIP_KEY, [
            context.getHandler(),
            context.getClass()
        ])

        if(isPublic || skipAuth) return true;

        console.log("AT GUARD");
        const req = context.switchToHttp().getRequest();
        console.log('Authorization Header:', req.headers.authorization);

        return super.canActivate(context);
    }
}
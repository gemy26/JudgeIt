import { CanActivate, ExecutionContext, GoneException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { Role } from "../enums";
import { ROLES_KEY } from "../decorators";

@Injectable()
export class RolesGuard implements CanActivate{
    constructor(private reflector: Reflector){}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {

        console.log("Here is RolesGuard")

        const requiredRoles  = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const isPublic  = this.reflector.getAllAndOverride<Role[]>('isPublic', [
            context.getHandler(),
            context.getClass()
        ]);

        if(isPublic) return true;
        if(!requiredRoles) return true;

        const req = context.switchToHttp().getRequest();
        const user = req?.user;

        console.log("User => ", user);
        
        if(!user) return false;

        const rolesToCheck = requiredRoles && requiredRoles.length > 0 
            ? requiredRoles 
            : [Role.USER];
       
        console.log(rolesToCheck);
        
        const result = rolesToCheck.some((role) => user.roles?.includes(role));

        console.log(result);

        return result;
    }
}   
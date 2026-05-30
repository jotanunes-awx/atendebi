import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AtendeBIRole } from './app-roles';
import { MockAuthenticatedUser } from './mock-auth.guard';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<AtendeBIRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: MockAuthenticatedUser }>();
    const userRoles = request.user?.roles ?? [];
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (hasRole) {
      return true;
    }

    throw new ForbiddenException({
      message: 'User does not have permission to access this resource',
      requiredRoles,
      userRoles,
    });
  }
}

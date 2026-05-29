import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

export type MockAuthenticatedUser = {
  id: string;
  tenantId: string;
  roles: string[];
};

@Injectable()
export class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const rolesHeader = request.header('x-roles') ?? 'ATENDEBI_ADMIN';

    request.user = {
      id: request.header('x-user-id') ?? 'local-user',
      tenantId: request.header('x-tenant-id') ?? 'local-tenant',
      roles: rolesHeader
        .split(',')
        .map((role: string) => role.trim())
        .filter(Boolean),
    } satisfies MockAuthenticatedUser;

    return true;
  }
}

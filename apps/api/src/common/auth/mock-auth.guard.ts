import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AtendeBIRole, isAtendeBIRole } from './app-roles';
import { EntraClaims, EntraTokenService } from './entra-token.service';

export type MockAuthenticatedUser = {
  id: string;
  tenantId: string;
  roles: AtendeBIRole[];
  email?: string;
  name?: string;
  authProvider?: 'mock' | 'entra';
};

@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly entraTokenService: EntraTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authMode = this.configService.get<string>('AUTH_MODE', 'mock').toLowerCase();
    const bearerToken = extractBearerToken(request.header('authorization'));

    if (bearerToken) {
      try {
        const claims = await this.entraTokenService.verifyAccessToken(bearerToken);
        request.user = this.buildEntraUser(claims, request);
        return true;
      } catch (error) {
        if (authMode === 'entra') {
          throw error;
        }
      }
    }

    if (authMode === 'entra' && !this.allowMockHeaders()) {
      throw new UnauthorizedException('Bearer token from Microsoft Entra ID is required');
    }

    request.user = this.buildMockUser(request);

    return true;
  }

  private buildMockUser(request: { header: (name: string) => string | undefined }): MockAuthenticatedUser {
    return {
      id: request.header('x-user-id') ?? 'local-user',
      tenantId: request.header('x-tenant-id') ?? this.configService.get<string>('AUTH_TENANT_KEY', 'local-tenant'),
      roles: parseRoles(request.header('x-roles') ?? this.configService.get<string>('AUTH_DEFAULT_ROLES', 'ATENDEBI_ADMIN')),
      authProvider: 'mock',
    };
  }

  private buildEntraUser(
    claims: EntraClaims,
    request: { header: (name: string) => string | undefined },
  ): MockAuthenticatedUser {
    const fallbackRoles = this.allowMockHeaders()
      ? parseRoles(request.header('x-roles') ?? this.configService.get<string>('ENTRA_DEFAULT_ROLE', ''))
      : parseRoles(this.configService.get<string>('ENTRA_DEFAULT_ROLE', ''));
    const claimRoles = parseRoles((claims.roles ?? []).join(','));
    const roles = claimRoles.length > 0 ? claimRoles : fallbackRoles;
    const tenantId =
      firstConfiguredValue(
        this.configService.get<string>('AUTH_TENANT_KEY'),
        this.configService.get<string>('ENTRA_TENANT_KEY'),
        this.allowMockHeaders() ? request.header('x-tenant-id') : undefined,
        claims.tid,
      ) ?? 'local-tenant';

    return {
      id: claims.oid ?? claims.sub ?? 'entra-user',
      tenantId,
      roles,
      email: claims.preferred_username ?? claims.email,
      name: claims.name,
      authProvider: 'entra',
    };
  }

  private allowMockHeaders() {
    return this.configService.get<string>('AUTH_ALLOW_MOCK_HEADERS', 'false') === 'true';
  }
}

function extractBearerToken(authorizationHeader?: string) {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authorizationHeader.slice('Bearer '.length).trim();
}

function parseRoles(roles: string) {
  return roles
    .split(',')
    .map((role) => role.trim())
    .filter(isAtendeBIRole);
}

function hasConfiguredValue(value?: string) {
  if (!value?.trim()) {
    return false;
  }

  const trimmed = value.trim();

  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(trimmed)) {
    return false;
  }

  return !/^(SEU_|SUA_|COLE_AQUI|VALOR_|CHANGEME|CHANGE_ME)/i.test(trimmed);
}

function firstConfiguredValue(...values: Array<string | undefined>) {
  return values.find((value) => hasConfiguredValue(value));
}

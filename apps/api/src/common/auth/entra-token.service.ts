import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';

export type EntraClaims = jwt.JwtPayload & {
  name?: string;
  oid?: string;
  preferred_username?: string;
  email?: string;
  roles?: string[];
  groups?: string[];
  tid?: string;
};

@Injectable()
export class EntraTokenService {
  private readonly clients = new Map<string, JwksClient>();

  constructor(private readonly configService: ConfigService) {}

  async verifyAccessToken(token: string): Promise<EntraClaims> {
    const tenantId = firstConfiguredValue(
      this.configService.get<string>('ENTRA_TENANT_ID'),
      this.configService.get<string>('AZURE_TENANT_ID'),
      this.configService.get<string>('TEAMS_TENANT_ID'),
    );
    const audiences = splitCsv(
      firstConfiguredValue(
        this.configService.get<string>('ENTRA_API_AUDIENCE'),
        this.configService.get<string>('ENTRA_AUDIENCE'),
        this.configService.get<string>('ENTRA_CLIENT_ID'),
      ),
    );

    if (!tenantId || audiences.length === 0) {
      throw new UnauthorizedException({
        message: 'Entra ID token validation is not configured',
        required: ['ENTRA_TENANT_ID', 'ENTRA_API_AUDIENCE ou ENTRA_CLIENT_ID'],
      });
    }

    const issuers = [`https://login.microsoftonline.com/${tenantId}/v2.0`, `https://sts.windows.net/${tenantId}/`];
    const jwksUri = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
    const client = this.getClient(jwksUri);
    const audience = audiences.length === 1 ? audiences[0] : (audiences as [string, ...string[]]);

    return new Promise<EntraClaims>((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          if (!header.kid) {
            callback(new Error('Token header does not contain kid'));
            return;
          }

          client.getSigningKey(header.kid, (error, key) => {
            if (error) {
              callback(error);
              return;
            }

            callback(null, key?.getPublicKey());
          });
        },
        {
          algorithms: ['RS256'],
          audience,
          issuer: issuers as [string, ...string[]],
        },
        (error: jwt.VerifyErrors | null, decoded: jwt.Jwt | jwt.JwtPayload | string | undefined) => {
          if (error || !decoded || typeof decoded === 'string') {
            reject(
              new UnauthorizedException({
                message: 'Invalid Entra ID access token',
                detail: error?.message,
              }),
            );
            return;
          }

          resolve(decoded as EntraClaims);
        },
      );
    });
  }

  private getClient(jwksUri: string) {
    const existingClient = this.clients.get(jwksUri);

    if (existingClient) {
      return existingClient;
    }

    const client = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });

    this.clients.set(jwksUri, client);

    return client;
  }
}

function splitCsv(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(hasConfiguredValue);
}

function hasConfiguredValue(value?: string) {
  if (!value?.trim()) {
    return false;
  }

  const trimmed = value.trim();

  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(trimmed)) {
    return false;
  }

  return !/^(SEU_|SUA_|COLE_AQUI|VALOR_|CHANGEME|CHANGE_ME|api:\/\/atendebi-local)/i.test(trimmed);
}

function firstConfiguredValue(...values: Array<string | undefined>) {
  return values.find((value) => hasConfiguredValue(value));
}

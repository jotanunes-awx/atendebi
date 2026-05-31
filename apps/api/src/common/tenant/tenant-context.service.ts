import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTenantId(tenantHeader?: string): Promise<string | null> {
    const tenantLocator = tenantHeader?.trim() || 'local-tenant';

    if (uuidPattern.test(tenantLocator)) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantLocator },
        select: { id: true, status: true },
      });

      return tenant?.status === 'ACTIVE' ? tenant.id : null;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { key: tenantLocator },
      select: { id: true, status: true },
    });

    return tenant?.status === 'ACTIVE' ? tenant.id : null;
  }
}

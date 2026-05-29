import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'API healthcheck' })
  check() {
    return {
      status: 'ok',
      service: 'atendebi-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

import { Body, Controller, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BlipWebhookParamsDto, BlipWebhookResponseDto } from './dto/blip-webhook.dto';
import { BlipWebhookService } from './blip-webhook.service';

@ApiTags('Webhooks')
@Controller('webhooks/blip')
export class BlipWebhookController {
  constructor(private readonly blipWebhookService: BlipWebhookService) {}

  @Post(':tenantKey')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receives BLiP webhook events for a tenant' })
  @ApiParam({ name: 'tenantKey', description: 'Public tenant key registered in AtendeBI' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
    },
  })
  @ApiResponse({ status: 200, type: BlipWebhookResponseDto })
  receive(
    @Param() params: BlipWebhookParamsDto,
    @Body() payload: Record<string, unknown>,
    @Headers('x-atendebi-webhook-secret') webhookSecret?: string,
  ) {
    return this.blipWebhookService.receive(params.tenantKey, payload, webhookSecret);
  }
}

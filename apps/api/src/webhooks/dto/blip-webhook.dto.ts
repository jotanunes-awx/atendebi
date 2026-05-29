import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class BlipWebhookParamsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/)
  tenantKey!: string;
}

export class BlipWebhookResponseDto {
  status!: 'received';
  rawEventId!: string;
  duplicate!: boolean;
  queued!: boolean;
}

export const EVENT_PROCESSING_QUEUE = 'raw-event-processing';
export const INTEGRATION_SYNC_QUEUE = 'integration-sync';

export type RawEventProcessingJob = {
  rawEventId: string;
  tenantId: string;
};

export type IntegrationSyncJob = {
  provider: string;
  tenantId: string;
  requestedAt: string;
};

export const EVENT_PROCESSING_QUEUE = 'raw-event-processing';

export type RawEventProcessingJob = {
  rawEventId: string;
  tenantId: string;
};

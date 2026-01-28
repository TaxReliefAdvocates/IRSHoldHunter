export type { Job, CallLeg, JobWithLegs, JobStatus, LegStatus } from '../storage/RedisStore.js';

export interface RCCallOutResponse {
  sessionId: string;
  parties: Array<{
    id: string;
    direction: string;
  }>;
}

export interface RCWebhookPayload {
  timestamp: string;
  uuid: string;
  event: string;
  subscriptionId: string;
  body: {
    telephonySessionId: string;
    parties: Array<{
      id: string;
      extensionId: string;
      status: {
        code: string;
        reason?: string;
      };
      direction: string;
    }>;
  };
}

export interface StartJobRequest {
  irsNumber?: string;
  queueId?: string;
  lineCount?: number;
  poolName?: string;
  specificExtensionIds?: string[];
}

export interface StartJobResponse {
  jobId: string;
  message: string;
}

export interface RCCallQueue {
  id: string;
  extensionNumber: string;
  name: string;
  status: string;
  subType: string;
}

export interface RCQueueDetails {
  id: string;
  extensionNumber: string;
  name: string;
  phoneNumber: string;
  email: string;
  status: string;
}

export interface QueueConfig {
  id: string;
  name: string;
  phoneNumber: string;
  extensionNumber: string;
  isDefault: boolean;
  tags: string[];
  lastUsed?: string;
}

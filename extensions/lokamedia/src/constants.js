export const EXTENSION_VERSION = '0.1.18';
export const STORAGE_SCHEMA_VERSION = 1;
export const LOKAMEDIA_PROTOCOL_VERSION = 1;

export const PROVIDER_OPERATION_TIMEOUT_MS = 120_000;
export const HEARTBEAT_INTERVAL_MS = 60_000;
export const LEASE_SECONDS = 300;
export const UPLOAD_CONCURRENCY = 2;
export const PROVIDER_GENERATION_CONCURRENCY = 1;
export const IMAGE_CAPTURE_CONCURRENCY = 1;
export const MAX_PENDING_CAPTURED_ASSETS = 4;
export const MAX_PENDING_CAPTURED_BYTES = 20 * 1024 * 1024;

export const TERMINAL_STATUSES = new Set([
  'COMPLETE',
  'FAILED_TERMINAL',
  'SUPERSEDED',
  'CANCELLED'
]);

export const STOP_ACTIONS = new Set([
  'STOP',
  'COMPLETE',
  'REAUTHENTICATE'
]);

export const DEFAULT_CONFIG = {
  serverBaseUrl: 'http://localhost:4321',
  deviceToken: '',
  deviceId: 'dev_local_human_operator_v3',
  enabled: false,
  acquisitionProbe: false,
  providerResultProbe: false,
  captureBlobProbe: false
};

export function nowIso(clock = Date) {
  return new clock().toISOString();
}

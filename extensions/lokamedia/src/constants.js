export const EXTENSION_VERSION = '0.1.24';
export const STORAGE_SCHEMA_VERSION = 2;
export const LOKAMEDIA_PROTOCOL_VERSION = 1;

export const BACKEND_ENVIRONMENTS = {
  LOCAL: {
    id: 'local',
    label: 'Local Development',
    defaultUrl: 'http://localhost:4321',
    defaultDeviceId: 'dev_local_tokenless'
  },
  STAGING: {
    id: 'staging',
    label: 'Staging',
    defaultUrl: 'https://staging.rancangloka.com',
    defaultDeviceId: 'dev_staging_operator'
  },
  PRODUCTION: {
    id: 'production',
    label: 'Production',
    defaultUrl: 'https://rancangloka.com',
    defaultDeviceId: 'dev_production_operator'
  }
};

export function detectEnvironment(url) {
  if (!url || typeof url !== 'string') return 'local';
  const clean = url.trim().toLowerCase();
  if (
    clean.includes('localhost') ||
    clean.includes('127.0.0.1') ||
    clean.includes('0.0.0.0') ||
    clean.includes('[::1]')
  ) {
    return 'local';
  }
  if (clean.includes('staging') || clean.includes('preview')) return 'staging';
  if (clean.includes('rancangloka.com')) return 'production';
  return 'production';
}

export function getCanonicalEnvironmentUrl(env) {
  const norm = String(env || 'local').toUpperCase();
  return BACKEND_ENVIRONMENTS[norm]?.defaultUrl || BACKEND_ENVIRONMENTS.LOCAL.defaultUrl;
}

export function isUrlConsistentWithEnvironment(env, url) {
  if (!url || typeof url !== 'string') return false;
  const detected = detectEnvironment(url);
  const norm = String(env || '').toLowerCase();
  return detected === norm;
}

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
  deviceId: 'dev_local_tokenless',
  enabled: false,
  acquisitionProbe: false,
  providerResultProbe: false,
  captureBlobProbe: false
};

export function nowIso(clock = Date) {
  return new clock().toISOString();
}

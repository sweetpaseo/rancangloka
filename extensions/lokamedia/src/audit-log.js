import { EXTENSION_VERSION } from './constants.js';

export const MAX_AUDIT_EVENTS = 1000;
export const AUDIT_RETENTION_DAYS = 7;

const SECRET_KEYS = ['authorization', 'cookie', 'token', 'password', 'secret', 'binary', 'blob', 'bytes', 'base64'];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function safeString(value, max = 240) {
  return String(value ?? '').replace(/[^\w\s:./@-]/g, '_').slice(0, max);
}

export function safeError(error) {
  return {
    name: safeString(error?.name || 'Error', 80),
    message_safe: safeString(error?.message || error || 'UNKNOWN_ERROR'),
    error_code: safeString(error?.code || error?.payload?.code || error?.status || 'UNKNOWN_ERROR', 80),
    status: error?.status ?? error?.statusCode ?? null
  };
}

export function redactDetails(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactDetails).slice(0, 50);
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    const lowered = key.toLowerCase();
    if (SECRET_KEYS.some((secret) => lowered.includes(secret))) {
      result[key] = '[REDACTED]';
    } else if (typeof item === 'string') {
      result[key] = safeString(item, 500);
    } else if (typeof item === 'object') {
      result[key] = redactDetails(item);
    } else {
      result[key] = item;
    }
  }
  return result;
}

export class AuditLogger {
  constructor({ storage, component = 'extension', clock = Date } = {}) {
    this.storage = storage;
    this.component = component;
    this.clock = clock;
  }

  async event(level, eventCode, context = {}) {
    if (!this.storage?.appendAuditEvent) return null;
    return this.storage.appendAuditEvent({
      timestamp: new this.clock().toISOString(),
      level,
      component: context.component || this.component,
      event_code: eventCode,
      message_safe: safeString(context.message_safe || eventCode),
      run_id: context.run_id || null,
      job_id: context.job_id || null,
      article_id: context.article_id ?? null,
      slot_key: context.slot_key || null,
      provider_stage: context.provider_stage || null,
      server_job_status: context.server_job_status || null,
      error_code: context.error_code || null,
      duration_ms: context.duration_ms ?? null,
      details: redactDetails(context.details || {})
    });
  }

  info(eventCode, context) {
    return this.event('INFO', eventCode, context);
  }

  warn(eventCode, context) {
    return this.event('WARN', eventCode, context);
  }

  error(eventCode, context) {
    const error = context?.error ? safeError(context.error) : {};
    return this.event('ERROR', eventCode, {
      ...context,
      error_code: context?.error_code || error.error_code,
      message_safe: context?.message_safe || error.message_safe || eventCode,
      details: { ...(context?.details || {}), error }
    });
  }
}

export function formatAuditText({ events = [], state = {}, generatedAt = new Date().toISOString() } = {}) {
  const run = state.phase4bSingleRun || {};
  const activeVersion = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version)
    || state.runtime_extension_version
    || state.extension_version
    || EXTENSION_VERSION;
  const lines = [
    'LokaMedia Audit Log',
    `Extension Version: ${activeVersion}`,
    'Protocol Version: 1',
    'DOM Adapter Version: 1',
    `Generated At: ${generatedAt}`,
    `Run ID: ${run.phase4b_single_run_id || ''}`,
    `Job ID: ${run.job_id || ''}`,
    ''
  ];
  for (const event of events) {
    lines.push(`${event.timestamp} ${event.level} ${event.event_code} ${event.message_safe || ''}`);
    const meta = clone(event);
    delete meta.timestamp;
    delete meta.level;
    delete meta.event_code;
    delete meta.message_safe;
    lines.push(JSON.stringify(meta));
  }
  return lines.join('\n');
}

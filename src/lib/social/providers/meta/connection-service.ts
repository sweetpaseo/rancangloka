/**
 * RancangLoka — Meta Connection Persistence & Management Service
 * Milestone: SOCIAL-S3.5
 *
 * Stores non-secret connection metadata in site settings (D1 key-value).
 * Invariant: ZERO RAW SECRETS.
 * No access token or App Secret is stored in D1.
 */

import { getSiteSettings, updateSiteSettings } from '../../../db.ts';
import type { MetaConnectionHealth, MetaConnectionRecord } from './binding-types.ts';
import { evaluateConnectionHealth } from './connection-health.ts';

const SETTINGS_KEY_META_CONNECTION = 'social_meta_connection_json';

/**
 * Retrieve current Meta connection record from D1 settings
 */
export async function getMetaConnection(db: any): Promise<MetaConnectionRecord | null> {
  const settings = await getSiteSettings(db);
  const rawJson = settings[SETTINGS_KEY_META_CONNECTION];
  if (!rawJson) return null;

  try {
    const parsed = JSON.parse(rawJson);
    return parsed as MetaConnectionRecord;
  } catch (err) {
    console.warn('[MetaConnection] Failed to parse connection json:', err);
    return null;
  }
}

/**
 * Save updated Meta connection record to D1 settings
 * Invariant: Validates that no secret/token was accidentally injected
 */
export async function saveMetaConnection(db: any, record: MetaConnectionRecord): Promise<void> {
  // Defensive assertion against token persistence
  const recordAny = record as any;
  if (
    recordAny.accessToken ||
    recordAny.access_token ||
    recordAny.appSecret ||
    recordAny.app_secret ||
    recordAny.token
  ) {
    throw new Error('CRITICAL_SECURITY_VIOLATION: Raw access tokens or secrets must NEVER be saved to settings.');
  }

  // Enforce zero publishing authority invariant
  record.publishingAuthority = 0;
  record.updatedAt = new Date().toISOString();

  await updateSiteSettings(db, {
    [SETTINGS_KEY_META_CONNECTION]: JSON.stringify(record),
  });
}

/**
 * Retrieve normalized read-only connection health from D1
 */
export async function getMetaConnectionHealth(db: any): Promise<MetaConnectionHealth> {
  const conn = await getMetaConnection(db);
  return evaluateConnectionHealth(conn);
}

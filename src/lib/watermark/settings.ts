/**
 * RancangLoka — LokaMedia Watermark Settings Domain Model & Service
 * Phase 5D4A: Admin Watermark Settings Foundation
 *
 * Provides:
 * - Domain model & default configuration
 * - Guardrail validation and normalization (shared contract with watermark-engine.js)
 * - Durable settings versioning with no-bump on identical config
 * - Optimistic concurrency protection (stale revision rejection)
 * - Settings change audit logging
 * - Integration with D1 settings table
 */

export const WATERMARK_SETTINGS_KEY = 'watermark_settings';
export const WATERMARK_AUDIT_KEY = 'watermark_settings_audit';
export const WATERMARK_SETTINGS_SPEC_VERSION = 1;

export const WATERMARK_TYPES = Object.freeze({
  TEXT: 'TEXT',
  IMAGE: 'IMAGE'
});

export const WATERMARK_POSITIONS = Object.freeze({
  TOP_LEFT: 'top-left',
  TOP_RIGHT: 'top-right',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_RIGHT: 'bottom-right'
});

export interface WatermarkSettings {
  enabled: boolean;
  type: string;
  position: string;
  opacity: number;
  margin_x_ratio: number;
  margin_y_ratio: number;
  text: {
    value: string;
    font_size_ratio: number;
    font_weight: number;
  };
  image: {
    asset_id: string | null;
    width_ratio: number;
  };
  watermark_version: number;
}

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = Object.freeze({
  enabled: true,
  type: WATERMARK_TYPES.TEXT,
  position: WATERMARK_POSITIONS.BOTTOM_RIGHT,
  opacity: 0.62,
  margin_x_ratio: 0.022,
  margin_y_ratio: 0.028,
  text: Object.freeze({
    value: 'rancangloka.com',
    font_size_ratio: 0.022,
    font_weight: 500
  }),
  image: Object.freeze({
    asset_id: null,
    width_ratio: 0.12
  }),
  watermark_version: 1
});

// Guardrail boundaries (strictly synchronized with Watermark Engine 5D3A)
export const SETTINGS_BOUNDS = Object.freeze({
  opacity: { min: 0.30, max: 0.90 },
  font_size_ratio: { min: 0.012, max: 0.05 },
  image_width_ratio: { min: 0.05, max: 0.30 },
  margin_x_ratio: { min: 0.01, max: 0.08 },
  margin_y_ratio: { min: 0.01, max: 0.08 }
});

export class WatermarkSettingsValidationError extends Error {
  code: string;
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'WatermarkSettingsValidationError';
    this.code = code;
  }
}

export class WatermarkSettingsConcurrencyError extends Error {
  code: string;
  constructor(message: string, code: string = 'CONCURRENCY_CONFLICT') {
    super(message);
    this.name = 'WatermarkSettingsConcurrencyError';
    this.code = code;
  }
}

/**
 * Normalizes and validates incoming watermark settings.
 * Fails closed on invalid type, position, empty text, or out-of-bounds parameters.
 */
export function normalizeWatermarkSettings(raw: any = {}) {
  if (raw === null || typeof raw !== 'object') {
    throw new WatermarkSettingsValidationError('Settings must be a non-null object', 'INVALID_OBJECT');
  }

  const enabled = raw.enabled !== undefined ? Boolean(raw.enabled) : DEFAULT_WATERMARK_SETTINGS.enabled;
  const type = raw.type ?? DEFAULT_WATERMARK_SETTINGS.type;

  if (type !== WATERMARK_TYPES.TEXT && type !== WATERMARK_TYPES.IMAGE) {
    throw new WatermarkSettingsValidationError(
      `Invalid watermark type: '${type}'. Expected TEXT or IMAGE.`,
      'INVALID_TYPE'
    );
  }

  const position = raw.position ?? DEFAULT_WATERMARK_SETTINGS.position;
  const validPositions = Object.values(WATERMARK_POSITIONS);
  if (!validPositions.includes(position)) {
    throw new WatermarkSettingsValidationError(
      `Invalid position: '${position}'. Expected one of ${validPositions.join(', ')}.`,
      'INVALID_POSITION'
    );
  }

  const opacity = Number(raw.opacity ?? DEFAULT_WATERMARK_SETTINGS.opacity);
  if (Number.isNaN(opacity) || opacity < SETTINGS_BOUNDS.opacity.min || opacity > SETTINGS_BOUNDS.opacity.max) {
    throw new WatermarkSettingsValidationError(
      `Opacity ${opacity} outside permitted range [${SETTINGS_BOUNDS.opacity.min}, ${SETTINGS_BOUNDS.opacity.max}]`,
      'INVALID_OPACITY'
    );
  }

  const margin_x_ratio = Number(raw.margin_x_ratio ?? DEFAULT_WATERMARK_SETTINGS.margin_x_ratio);
  if (
    Number.isNaN(margin_x_ratio) ||
    margin_x_ratio < SETTINGS_BOUNDS.margin_x_ratio.min ||
    margin_x_ratio > SETTINGS_BOUNDS.margin_x_ratio.max
  ) {
    throw new WatermarkSettingsValidationError(
      `margin_x_ratio ${margin_x_ratio} outside permitted range [${SETTINGS_BOUNDS.margin_x_ratio.min}, ${SETTINGS_BOUNDS.margin_x_ratio.max}]`,
      'INVALID_MARGIN_X'
    );
  }

  const margin_y_ratio = Number(raw.margin_y_ratio ?? DEFAULT_WATERMARK_SETTINGS.margin_y_ratio);
  if (
    Number.isNaN(margin_y_ratio) ||
    margin_y_ratio < SETTINGS_BOUNDS.margin_y_ratio.min ||
    margin_y_ratio > SETTINGS_BOUNDS.margin_y_ratio.max
  ) {
    throw new WatermarkSettingsValidationError(
      `margin_y_ratio ${margin_y_ratio} outside permitted range [${SETTINGS_BOUNDS.margin_y_ratio.min}, ${SETTINGS_BOUNDS.margin_y_ratio.max}]`,
      'INVALID_MARGIN_Y'
    );
  }

  // Non-destructive preservation: validate and retain both text and image configs
  const rawText = raw.text || {};
  const textValue = (rawText.value ?? DEFAULT_WATERMARK_SETTINGS.text.value);
  if (typeof textValue !== 'string' || textValue.trim().length === 0) {
    if (type === WATERMARK_TYPES.TEXT) {
      throw new WatermarkSettingsValidationError(
        'Watermark text value must be a non-empty string',
        'EMPTY_TEXT'
      );
    }
  }

  const fontSizeRatio = Number(rawText.font_size_ratio ?? DEFAULT_WATERMARK_SETTINGS.text.font_size_ratio);
  if (
    Number.isNaN(fontSizeRatio) ||
    fontSizeRatio < SETTINGS_BOUNDS.font_size_ratio.min ||
    fontSizeRatio > SETTINGS_BOUNDS.font_size_ratio.max
  ) {
    throw new WatermarkSettingsValidationError(
      `font_size_ratio ${fontSizeRatio} outside permitted range [${SETTINGS_BOUNDS.font_size_ratio.min}, ${SETTINGS_BOUNDS.font_size_ratio.max}]`,
      'INVALID_FONT_SIZE_RATIO'
    );
  }

  const fontWeight = Number(rawText.font_weight ?? DEFAULT_WATERMARK_SETTINGS.text.font_weight);

  const textConfig = {
    value: typeof textValue === 'string' ? textValue.trim() : DEFAULT_WATERMARK_SETTINGS.text.value,
    font_size_ratio: fontSizeRatio,
    font_weight: Number.isNaN(fontWeight) ? DEFAULT_WATERMARK_SETTINGS.text.font_weight : fontWeight
  };

  const rawImage = raw.image || {};
  const widthRatio = Number(rawImage.width_ratio ?? DEFAULT_WATERMARK_SETTINGS.image.width_ratio);
  if (
    Number.isNaN(widthRatio) ||
    widthRatio < SETTINGS_BOUNDS.image_width_ratio.min ||
    widthRatio > SETTINGS_BOUNDS.image_width_ratio.max
  ) {
    throw new WatermarkSettingsValidationError(
      `image.width_ratio ${widthRatio} outside permitted range [${SETTINGS_BOUNDS.image_width_ratio.min}, ${SETTINGS_BOUNDS.image_width_ratio.max}]`,
      'INVALID_IMAGE_WIDTH_RATIO'
    );
  }

  const assetId = rawImage.asset_id ?? null;
  // Security guard: no remote URLs or SVG references allowed as asset_id
  if (assetId) {
    if (typeof assetId !== 'string' || assetId.startsWith('http://') || assetId.startsWith('https://') || assetId.endsWith('.svg')) {
      throw new WatermarkSettingsValidationError(
        'Remote URLs and SVG formats are strictly barred from watermark asset identity.',
        'SECURITY_INVALID_ASSET'
      );
    }
  }

  if (type === WATERMARK_TYPES.IMAGE && !assetId) {
    throw new WatermarkSettingsValidationError(
      'Watermark image is valid but has not been stored yet. Canonical asset_id is required for active IMAGE mode.',
      'MISSING_ASSET_ID'
    );
  }

  const imageConfig = {
    asset_id: assetId,
    width_ratio: widthRatio
  };

  const watermarkVersion = Math.max(1, Number(raw.watermark_version ?? DEFAULT_WATERMARK_SETTINGS.watermark_version) || 1);

  return {
    enabled,
    type,
    position,
    opacity,
    margin_x_ratio,
    margin_y_ratio,
    text: textConfig,
    image: imageConfig,
    watermark_version: watermarkVersion
  };
}

/**
 * Compares two normalized settings objects to determine if a functional change occurred.
 * Ignores watermark_version and timestamps.
 */
export function areSettingsFunctionallyIdentical(a: any, b: any): boolean {
  if (!a || !b) return false;
  return (
    a.enabled === b.enabled &&
    a.type === b.type &&
    a.position === b.position &&
    a.opacity === b.opacity &&
    a.margin_x_ratio === b.margin_x_ratio &&
    a.margin_y_ratio === b.margin_y_ratio &&
    a.text?.value === b.text?.value &&
    a.text?.font_size_ratio === b.text?.font_size_ratio &&
    a.text?.font_weight === b.text?.font_weight &&
    a.image?.asset_id === b.image?.asset_id &&
    a.image?.width_ratio === b.image?.width_ratio
  );
}

/**
 * Reads current watermark settings from D1 database.
 * Falls back to canonical defaults if unconfigured.
 */
export async function getD1WatermarkSettings(db: any): Promise<WatermarkSettings> {
  if (db && typeof db.prepare === 'function') {
    try {
      const row = await db
        .prepare('SELECT value FROM settings WHERE key = ? LIMIT 1')
        .bind(WATERMARK_SETTINGS_KEY)
        .first();

      if (row && row.value) {
        const parsed = JSON.parse(row.value);
        return normalizeWatermarkSettings(parsed);
      }
    } catch (err) {
      console.warn('D1 Query watermark_settings fallback to defaults:', err);
    }
  }
  return { ...DEFAULT_WATERMARK_SETTINGS };
}

/**
 * Saves watermark settings to D1 database with optimistic concurrency and audit logging.
 */
export async function saveD1WatermarkSettings(
  db: any,
  rawNewSettings: any,
  options: {
    expectedVersion?: number;
    actor?: string;
  } = {}
): Promise<{
  status: string;
  settings: WatermarkSettings;
  versionBumped: boolean;
  auditRecorded: boolean;
}> {
  const current = await getD1WatermarkSettings(db);

  // Optimistic concurrency protection
  if (options.expectedVersion !== undefined && options.expectedVersion !== null) {
    if (Number(options.expectedVersion) !== current.watermark_version) {
      throw new WatermarkSettingsConcurrencyError(
        `Stale settings revision: expected version ${options.expectedVersion} but current is ${current.watermark_version}`,
        'STALE_SETTINGS_REVISION'
      );
    }
  }

  // Normalize new settings
  const normalized = normalizeWatermarkSettings({
    ...rawNewSettings,
    watermark_version: current.watermark_version
  });

  // Check if identical to current configuration
  const isIdentical = areSettingsFunctionallyIdentical(current, normalized);
  let newVersion = current.watermark_version;
  let versionBumped = false;

  if (!isIdentical) {
    newVersion = current.watermark_version + 1;
    versionBumped = true;
  }

  const finalSettings = {
    ...normalized,
    watermark_version: newVersion
  };

  if (db && typeof db.prepare === 'function') {
    const serialized = JSON.stringify(finalSettings);
    await db
      .prepare(
        'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
      )
      .bind(WATERMARK_SETTINGS_KEY, serialized)
      .run();

    // Record audit event if changed
    if (versionBumped) {
      try {
        const auditEvent = {
          previous_version: current.watermark_version,
          new_version: newVersion,
          changed_at: new Date().toISOString(),
          actor: options.actor || 'admin'
        };

        // Append to audit history in settings
        let history: any[] = [];
        const existingAuditRow = await db
          .prepare('SELECT value FROM settings WHERE key = ? LIMIT 1')
          .bind(WATERMARK_AUDIT_KEY)
          .first();
        if (existingAuditRow && existingAuditRow.value) {
          try {
            history = JSON.parse(existingAuditRow.value);
          } catch {}
        }
        history.unshift(auditEvent);
        if (history.length > 50) history = history.slice(0, 50);

        await db
          .prepare(
            'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
          )
          .bind(WATERMARK_AUDIT_KEY, JSON.stringify(history))
          .run();
      } catch (auditErr) {
        console.warn('Failed to record watermark audit event:', auditErr);
      }
    }
  }

  return {
    status: 'success',
    settings: finalSettings,
    versionBumped,
    auditRecorded: versionBumped
  };
}

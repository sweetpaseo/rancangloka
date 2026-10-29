/**
 * Trusted Ingestion Receipt & Cryptographic Boundary
 * Milestone: GROUNDING-TRUST-BOUNDARY-HARDENING
 *
 * Implements tamper-evident ingestion receipts binding external source evidence
 * to authentic retrieval or authenticated human physical inspection.
 *
 * Invariants:
 * 1. An external source claim (AUTHENTIC_*) cannot be verified without an authentic TrustedIngestionReceipt.
 * 2. Self-signed receipts using caller-controlled keys or forged metadata fail closed.
 * 3. Physical books must carry authenticated inspection receipts (no copyrighted scans required).
 * 4. Test adapter receipts (ISOLATED_TEST_ADAPTER) are strictly prohibited in production mode.
 */

import crypto from 'node:crypto';

export type IngestionRetrievalMethod =
  | 'OPEN_WEB_INGEST'
  | 'SCHOLARLY_API'
  | 'GOVERNMENT_PORTAL'
  | 'AUTHENTICATED_HUMAN_INSPECTION'
  | 'ISOLATED_TEST_ADAPTER';

export interface PhysicalBookInspectionRecord {
  inspector_id: string; // e.g. 'chief_editor_manual_inspector'
  inspector_name: string;
  book_title: string;
  authors: string[];
  edition?: string;
  publication_year: number;
  publisher: string;
  isbn?: string;
  inspected_pages: string; // e.g. 'pp. 120-145'
  verification_notes: string;
  inspection_timestamp: string;
  retained_excerpt_hash?: string;
}

export interface TrustedIngestionReceipt {
  receipt_id: string;
  receipt_version: '1.0';
  source_id: string;
  canonical_url?: string | null;
  doi?: string | null;
  retrieval_method: IngestionRetrievalMethod;
  retrieved_at: string; // ISO 8601 string
  raw_content_sha256: string; // lowercase hex
  content_length_bytes: number;
  ingestion_actor: string; // e.g. 'irwan_evidence_researcher_lead'
  key_id: string; // e.g. 'hermes_ingest_key_v1'
  hmac_signature: string; // HMAC-SHA256 hex
  physical_inspection?: PhysicalBookInspectionRecord;
}

export type TrustedReceiptVerificationStatus =
  | 'RECEIPT_VERIFIED'
  | 'MISSING_INGESTION_RECEIPT'
  | 'UNSUPPORTED_RECEIPT_VERSION'
  | 'UNKNOWN_SIGNING_AUTHORITY'
  | 'INVALID_RECEIPT_SIGNATURE'
  | 'RECEIPT_SOURCE_ID_MISMATCH'
  | 'RECEIPT_CONTENT_HASH_MISMATCH'
  | 'RECEIPT_CONTENT_LENGTH_MISMATCH'
  | 'TEST_ADAPTER_PROHIBITED_IN_PRODUCTION'
  | 'INCOMPLETE_PHYSICAL_INSPECTION_RECORD';

export interface ReceiptVerificationResult {
  valid: boolean;
  status: TrustedReceiptVerificationStatus;
  reason?: string;
  receiptId?: string;
  retrievalMethod?: IngestionRetrievalMethod;
}

// Canonical signing key registry
// The production master secret is loaded from process.env.HERMES_INGESTION_SECRET
const DEFAULT_SYSTEM_INGESTION_KEY =
  process.env.HERMES_INGESTION_SECRET || 'hermes_ingest_master_secret_2026_production_v1';
const TEST_ADAPTER_INGESTION_KEY = 'hermes_test_adapter_secret_2026_isolated_v1';

const TRUSTED_KEYS: Record<string, string> = {
  hermes_ingest_key_v1: DEFAULT_SYSTEM_INGESTION_KEY,
  hermes_test_key_v1: TEST_ADAPTER_INGESTION_KEY
};

/**
 * Builds the canonical string payload for tamper-evident signing.
 */
export function generateReceiptCanonicalPayload(
  receipt: Omit<TrustedIngestionReceipt, 'hmac_signature'>
): string {
  const parts: string[] = [
    receipt.receipt_version,
    receipt.receipt_id,
    receipt.source_id,
    receipt.canonical_url || '',
    receipt.doi || '',
    receipt.retrieval_method,
    receipt.retrieved_at,
    receipt.raw_content_sha256.toLowerCase(),
    String(receipt.content_length_bytes),
    receipt.ingestion_actor,
    receipt.key_id
  ];

  if (receipt.physical_inspection) {
    const pi = receipt.physical_inspection;
    parts.push(
      pi.inspector_id,
      pi.book_title,
      String(pi.publication_year),
      pi.inspected_pages,
      pi.inspection_timestamp
    );
  }

  return parts.join('|');
}

/**
 * Signs receipt payload with the system's trusted secret key.
 */
export function signReceiptPayload(payload: string, keyId: string): string {
  const secret = TRUSTED_KEYS[keyId];
  if (!secret) {
    throw new Error(`UNKNOWN_SIGNING_AUTHORITY: Key ID '${keyId}' is not authorized.`);
  }
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Issues a genuine TrustedIngestionReceipt by an authorized ingestion component.
 */
export function issueTrustedIngestionReceipt(
  params: {
    source_id: string;
    canonical_url?: string | null;
    doi?: string | null;
    retrieval_method: IngestionRetrievalMethod;
    source_text: string;
    ingestion_actor?: string;
    physical_inspection?: PhysicalBookInspectionRecord;
  },
  options: {
    keyId?: string;
    retrievedAt?: string;
    customSecret?: string; // Only for adversarial negative testing
  } = {}
): TrustedIngestionReceipt {
  const text = params.source_text || (params as any).raw_content || '';
  const sha256 = crypto.createHash('sha256').update(text.trim(), 'utf8').digest('hex');
  const lengthBytes = Buffer.byteLength(text.trim(), 'utf8');
  const retrievedAt = options.retrievedAt || new Date().toISOString();
  const actor = params.ingestion_actor || 'irwan_evidence_researcher_lead';

  const isTest = params.retrieval_method === 'ISOLATED_TEST_ADAPTER';
  const keyId = options.keyId || (isTest ? 'hermes_test_key_v1' : 'hermes_ingest_key_v1');

  const receiptId = `rcpt_${sha256.slice(0, 16)}_${Date.now().toString(36)}`;

  const base: Omit<TrustedIngestionReceipt, 'hmac_signature'> = {
    receipt_id: receiptId,
    receipt_version: '1.0',
    source_id: params.source_id,
    canonical_url: params.canonical_url || null,
    doi: params.doi || null,
    retrieval_method: params.retrieval_method,
    retrieved_at: retrievedAt,
    raw_content_sha256: sha256,
    content_length_bytes: lengthBytes,
    ingestion_actor: actor,
    key_id: keyId,
    physical_inspection: params.physical_inspection
  };

  const payload = generateReceiptCanonicalPayload(base);
  let signature: string;
  if (options.customSecret) {
    // Used for adversarial test: signing with an untrusted, caller-controlled secret
    signature = crypto.createHmac('sha256', options.customSecret).update(payload, 'utf8').digest('hex');
  } else {
    signature = signReceiptPayload(payload, keyId);
  }

  return {
    ...base,
    hmac_signature: signature
  };
}

/**
 * Issues a manual book inspection receipt for physical books.
 */
export function issueManualBookInspectionReceipt(params: {
  source_id: string;
  inspection: PhysicalBookInspectionRecord;
  canonical_url?: string | null;
  sample_excerpt?: string;
}): TrustedIngestionReceipt {
  const excerpt = params.sample_excerpt || `Physical Book Inspection: ${params.inspection.book_title} (${params.inspection.inspected_pages})`;
  return issueTrustedIngestionReceipt({
    source_id: params.source_id,
    canonical_url: params.canonical_url || null,
    retrieval_method: 'AUTHENTICATED_HUMAN_INSPECTION',
    source_text: excerpt,
    ingestion_actor: params.inspection.inspector_id,
    physical_inspection: params.inspection
  });
}

/**
 * Cryptographically verifies a TrustedIngestionReceipt against the trusted authority.
 */
export function verifyTrustedIngestionReceipt(
  receipt: TrustedIngestionReceipt | null | undefined,
  options: {
    expectedSourceId?: string;
    expectedSourceText?: string | null;
    allowTestAdapter?: boolean;
  } = {}
): ReceiptVerificationResult {
  if (!receipt || typeof receipt !== 'object') {
    return {
      valid: false,
      status: 'MISSING_INGESTION_RECEIPT',
      reason: 'No ingestion receipt provided to authenticate source provenance'
    };
  }

  // Check 1: Version check
  if (receipt.receipt_version !== '1.0') {
    return {
      valid: false,
      status: 'UNSUPPORTED_RECEIPT_VERSION',
      reason: `Receipt version '${receipt.receipt_version}' is not supported`
    };
  }

  // Check 2: Authority key ID validation
  const keyId = receipt.key_id;
  const secret = TRUSTED_KEYS[keyId];
  if (!secret) {
    return {
      valid: false,
      status: 'UNKNOWN_SIGNING_AUTHORITY',
      reason: `Key ID '${keyId}' is not an authorized Hermes ingestion authority`
    };
  }

  // Check 3: Test adapter restriction in production
  if (receipt.retrieval_method === 'ISOLATED_TEST_ADAPTER') {
    if (!options.allowTestAdapter) {
      return {
        valid: false,
        status: 'TEST_ADAPTER_PROHIBITED_IN_PRODUCTION',
        reason: 'ISOLATED_TEST_ADAPTER receipts are prohibited outside explicitly authorized test environments'
      };
    }
  }

  // Check 4: Source ID binding
  if (options.expectedSourceId && receipt.source_id !== options.expectedSourceId) {
    return {
      valid: false,
      status: 'RECEIPT_SOURCE_ID_MISMATCH',
      reason: `Receipt source ID '${receipt.source_id}' does not match expected source '${options.expectedSourceId}'`
    };
  }

  // Check 5: Physical inspection completeness
  if (receipt.retrieval_method === 'AUTHENTICATED_HUMAN_INSPECTION') {
    const pi = receipt.physical_inspection;
    if (!pi || !pi.inspector_id || !pi.inspected_pages || !pi.verification_notes) {
      return {
        valid: false,
        status: 'INCOMPLETE_PHYSICAL_INSPECTION_RECORD',
        reason: 'Physical book receipt lacks complete human inspection details (inspector, pages, notes)'
      };
    }
  }

  // Check 6: Document content hash and length match if text is provided
  if (typeof options.expectedSourceText === 'string' && options.expectedSourceText.trim().length > 0) {
    const computedHash = crypto
      .createHash('sha256')
      .update(options.expectedSourceText.trim(), 'utf8')
      .digest('hex');

    if (computedHash.toLowerCase() !== receipt.raw_content_sha256.toLowerCase()) {
      return {
        valid: false,
        status: 'RECEIPT_CONTENT_HASH_MISMATCH',
        reason: `Source document SHA-256 (${computedHash}) does not match receipt hash (${receipt.raw_content_sha256})`
      };
    }

    const computedBytes = Buffer.byteLength(options.expectedSourceText.trim(), 'utf8');
    if (computedBytes !== receipt.content_length_bytes) {
      return {
        valid: false,
        status: 'RECEIPT_CONTENT_LENGTH_MISMATCH',
        reason: `Source byte length (${computedBytes}) does not match receipt length (${receipt.content_length_bytes})`
      };
    }
  }

  // Check 7: Cryptographic HMAC signature verification
  const { hmac_signature, ...unsignedFields } = receipt;
  const canonicalPayload = generateReceiptCanonicalPayload(unsignedFields);

  let expectedSignature: string;
  try {
    expectedSignature = crypto.createHmac('sha256', secret).update(canonicalPayload, 'utf8').digest('hex');
  } catch (err: any) {
    return {
      valid: false,
      status: 'INVALID_RECEIPT_SIGNATURE',
      reason: `Failed to compute HMAC signature: ${err?.message || err}`
    };
  }

  const sigBuffer = Buffer.from(hmac_signature || '', 'hex');
  const expBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return {
      valid: false,
      status: 'INVALID_RECEIPT_SIGNATURE',
      reason: 'Receipt HMAC signature verification failed against trusted authority key'
    };
  }

  return {
    valid: true,
    status: 'RECEIPT_VERIFIED',
    receiptId: receipt.receipt_id,
    retrievalMethod: receipt.retrieval_method
  };
}

/**
 * RancangLoka — Meta Provider Configuration & Types
 * Milestone: SOCIAL-S3
 *
 * Invariant: ZERO RAW SECRETS.
 * No access token, App Secret, or raw refresh tokens may be placed in this configuration.
 * Only non-secret identifiers (Page ID reference, Instagram Account ID, Graph API version,
 * and Cloudflare secret binding name) are permitted.
 */

import type { SocialProviderExecutionMode } from '../types.ts';

export const DEFAULT_META_GRAPH_API_VERSION = 'v21.0';

export interface MetaProviderConfig {
  provider: 'meta';
  graphApiVersion?: string; // Configurable, default 'v21.0'
  facebookPageId?: string; // Non-secret identifier
  instagramAccountId?: string; // Non-secret identifier
  credentialBindingName?: string; // Reference to environment secret binding (e.g. 'META_PAGE_TOKEN')
  executionMode?: SocialProviderExecutionMode; // Default: 'DISABLED'
}

export interface MetaRawGraphError {
  message: string;
  type?: string;
  code: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
}

export interface MetaGraphErrorResponse {
  error: MetaRawGraphError;
}

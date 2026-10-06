/**
 * Discovery Network Safety & SSRF Guard
 * Milestone: RESEARCH-DISCOVERY-CAPABILITY-1
 *
 * Enforces strict network boundaries, preventing Server-Side Request Forgery (SSRF),
 * private IP leaks, cloud metadata exfiltration, and unsafe URI protocols.
 */

import { URL } from 'node:url';

export interface UrlValidationResult {
  isSafe: boolean;
  reason?: string;
  normalizedUrl?: string;
  parsedHost?: string;
  parsedProtocol?: string;
}

// Banned schemes
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

// Private IPv4 ranges (CIDRs) represented as numeric [start, end]
// 0.0.0.0/8
// 10.0.0.0/8
// 100.64.0.0/10 (Carrier Grade NAT)
// 127.0.0.0/8 (Loopback)
// 169.254.0.0/16 (Link Local & AWS/GCP/Azure Metadata 169.254.169.254)
// 172.16.0.0/12 (Private Class B)
// 192.0.0.0/24 (IETF Protocol Assignments)
// 192.0.2.0/24 (TEST-NET-1)
// 192.168.0.0/16 (Private Class C)
// 198.18.0.0/15 (Benchmarking)
// 198.51.100.0/24 (TEST-NET-2)
// 203.0.113.0/24 (TEST-NET-3)
// 224.0.0.0/4 (Multicast)
// 240.0.0.0/4 (Reserved / Broadcast)
function ipToLong(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const n = Number(parts[i]);
    if (isNaN(n) || n < 0 || n > 255 || parts[i].trim() === '' || (parts[i].length > 1 && parts[i].startsWith('0'))) {
      return null;
    }
    num = (num << 8) + n;
  }
  return num >>> 0;
}

function cidrToRange(cidrIp: string, prefixLen: number): [number, number] {
  const base = ipToLong(cidrIp)!;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  const start = (base & mask) >>> 0;
  const end = (start | ~mask) >>> 0;
  return [start, end];
}

const BLOCKED_IPV4_RANGES: [number, number][] = [
  cidrToRange('0.0.0.0', 8),
  cidrToRange('10.0.0.0', 8),
  cidrToRange('100.64.0.0', 10),
  cidrToRange('127.0.0.0', 8),
  cidrToRange('169.254.0.0', 16),
  cidrToRange('172.16.0.0', 12),
  cidrToRange('192.0.0.0', 24),
  cidrToRange('192.0.2.0', 24),
  cidrToRange('192.168.0.0', 16),
  cidrToRange('198.18.0.0', 15),
  cidrToRange('198.51.100.0', 24),
  cidrToRange('203.0.113.0', 24),
  cidrToRange('224.0.0.0', 4),
  cidrToRange('240.0.0.0', 4)
];

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.localdomain',
  '.corp',
  '.home',
  '.intranet'
];

const BLOCKED_EXACT_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'instance-data',
  '169.254.169.254',
  'metadata'
]);

/**
 * Checks whether an IP or hostname resolves to a blocked / private / metadata network.
 */
export function isPrivateOrBlockedHost(hostname: string): { isBlocked: boolean; reason?: string } {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_EXACT_HOSTNAMES.has(host)) {
    return { isBlocked: true, reason: `Blocked private or metadata hostname: ${host}` };
  }

  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (host.endsWith(suffix)) {
      return { isBlocked: true, reason: `Blocked local/internal domain suffix: ${suffix}` };
    }
  }

  // IPv4 numeric check
  const ipLong = ipToLong(host);
  if (ipLong !== null) {
    for (const [start, end] of BLOCKED_IPV4_RANGES) {
      if (ipLong >= start && ipLong <= end) {
        return { isBlocked: true, reason: `Blocked IPv4 address in restricted/private range: ${host}` };
      }
    }
    return { isBlocked: false };
  }

  // IPv6 check
  if (host.includes(':')) {
    if (host === '::1' || host === '0000:0000:0000:0000:0000:0000:0000:0001' || host === '::') {
      return { isBlocked: true, reason: `Blocked IPv6 loopback or unspecified address: ${host}` };
    }
    if (host.startsWith('fe80:') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')) {
      return { isBlocked: true, reason: `Blocked IPv6 link-local address: ${host}` };
    }
    if (host.startsWith('fc') || host.startsWith('fd')) {
      return { isBlocked: true, reason: `Blocked IPv6 unique local address: ${host}` };
    }
    if (host.startsWith('ff')) {
      return { isBlocked: true, reason: `Blocked IPv6 multicast address: ${host}` };
    }
    if (host.includes('::ffff:')) {
      // IPv4 mapped IPv6 e.g. ::ffff:127.0.0.1
      const mappedIpv4 = host.split('::ffff:')[1];
      if (mappedIpv4 && isPrivateOrBlockedHost(mappedIpv4).isBlocked) {
        return { isBlocked: true, reason: `Blocked IPv4-mapped IPv6 address: ${host}` };
      }
    }
  }

  return { isBlocked: false };
}

/**
 * Validates a candidate URL against all SSRF, protocol, and credential safety invariants.
 */
export function validateSafeUrl(urlString: string): UrlValidationResult {
  if (!urlString || typeof urlString !== 'string') {
    return { isSafe: false, reason: 'URL string is empty or invalid' };
  }

  const trimmed = urlString.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (err: any) {
    return { isSafe: false, reason: `Failed to parse URL: ${err.message || String(err)}` };
  }

  // 1. Protocol check
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return {
      isSafe: false,
      reason: `Unsupported URI protocol: '${parsed.protocol}'. Only http: and https: are permitted.`,
      parsedProtocol: parsed.protocol
    };
  }

  // 2. Reject credentials in URL (e.g. https://user:pass@host)
  if (parsed.username || parsed.password) {
    return {
      isSafe: false,
      reason: 'URL contains embedded credentials (username/password), which is disallowed.',
      parsedHost: parsed.hostname
    };
  }

  // 3. Hostname check
  const hostCheck = isPrivateOrBlockedHost(parsed.hostname);
  if (hostCheck.isBlocked) {
    return {
      isSafe: false,
      reason: hostCheck.reason,
      parsedHost: parsed.hostname
    };
  }

  // 4. Normalized clean URL
  const normalizedUrl = parsed.toString();

  return {
    isSafe: true,
    normalizedUrl,
    parsedHost: parsed.hostname,
    parsedProtocol: parsed.protocol
  };
}

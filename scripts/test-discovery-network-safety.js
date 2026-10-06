/**
 * Focused Outbound Network Safety & DNS Resolution Tests
 * Milestone: RESEARCH-DISCOVERY-RUNTIME-READINESS-1 (Section 10)
 *
 * Verifies that outbound network retrieval enforces strict pre-connection
 * destination IP safety, platform-aware DNS resolution validation, and
 * fail-closed redirect inspection without touching live SSRF endpoints.
 */

import assert from 'node:assert/strict';
import {
  validateSafeUrl,
  isPrivateOrBlockedHost,
  resolveHostAddresses,
  validateSafeUrlAndDns
} from '../src/lib/editorial/discovery-network-safety.ts';
import { fetchHttpDocument } from '../src/lib/editorial/source-discovery.ts';
import { resolveOpenAccessCandidate } from '../src/lib/editorial/open-access-resolver.ts';

console.log('--- STARTING DISCOVERY NETWORK SAFETY & DNS SUITE ---');

let passedTests = 0;

// =========================================================================
// TEST A: Public hostname resolves to public IP => allowed
// =========================================================================
{
  const mockDns = async (host) => {
    if (host === 'public-journal.org') return ['93.184.216.34'];
    return [];
  };

  const validation = await validateSafeUrlAndDns('https://public-journal.org/building-science.html', {
    dnsLookupFn: mockDns
  });

  assert.equal(validation.isSafe, true, 'Public hostname resolving to public IP must be safe');
  assert.deepEqual(validation.resolvedIps, ['93.184.216.34']);

  const mockFetch = async (url) => ({
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'text/html']]),
    text: async () => `
      <h1>Building Science and Indoor Air Quality Research</h1>
      <p>High performance residential mechanical ventilation guidelines and relative humidity control standards for humid tropical environments.</p>
      <p>Continuous mechanical exhaust prevents moisture accumulation, mold growth, and structural degradation in residential bathroom enclosures.</p>
    `.trim()
  });

  const res = await fetchHttpDocument('https://public-journal.org/building-science.html', {
    fetchFn: mockFetch,
    dnsLookupFn: mockDns
  });

  assert.equal(res.is_blocked, false, 'Retrieval must succeed');
  assert.equal(res.retrieval_status, 'SOURCE_RETRIEVED_AND_VERIFIED');
  console.log('[PASS] Test A: Public hostname resolves to public IP => allowed');
  passedTests++;
}

// =========================================================================
// TEST B: Public-looking hostname resolves to 127.0.0.1 (Loopback) => blocked
// =========================================================================
{
  const mockDns = async (host) => {
    if (host === 'innocent-building-portal.org') return ['127.0.0.1'];
    return [];
  };

  const validation = await validateSafeUrlAndDns('https://innocent-building-portal.org/standards.html', {
    dnsLookupFn: mockDns
  });

  assert.equal(validation.isSafe, false, 'Hostname resolving to 127.0.0.1 must be blocked');
  assert.ok(validation.reason?.includes('DNS_RESOLUTION_UNSAFE'));
  assert.ok(validation.reason?.includes('127.0.0.1'));

  const res = await fetchHttpDocument('https://innocent-building-portal.org/standards.html', {
    dnsLookupFn: mockDns
  });

  assert.equal(res.is_blocked, true);
  assert.ok(res.blocked_reason?.includes('SSRF_BLOCKED: DNS_RESOLUTION_UNSAFE'));
  console.log('[PASS] Test B: Public-looking hostname resolves to 127.0.0.1 => blocked');
  passedTests++;
}

// =========================================================================
// TEST C: Public-looking hostname resolves to 10.x.x.x (RFC 1918 Private) => blocked
// =========================================================================
{
  const mockDns = async (host) => {
    if (host === 'corp-engineering-archive.net') return ['10.24.1.88'];
    return [];
  };

  const validation = await validateSafeUrlAndDns('https://corp-engineering-archive.net/doc.pdf', {
    dnsLookupFn: mockDns
  });

  assert.equal(validation.isSafe, false, 'Hostname resolving to 10.x.x.x must be blocked');
  assert.ok(validation.reason?.includes('DNS_RESOLUTION_UNSAFE'));
  assert.ok(validation.reason?.includes('10.24.1.88'));
  console.log('[PASS] Test C: Public-looking hostname resolves to 10.x.x.x => blocked');
  passedTests++;
}

// =========================================================================
// TEST D: Hostname resolves to mixed public + private addresses => blocked
// =========================================================================
{
  const mockDns = async (host) => {
    if (host === 'dual-homed-target.com') return ['93.184.216.34', '192.168.1.100'];
    return [];
  };

  const validation = await validateSafeUrlAndDns('https://dual-homed-target.com/spec', {
    dnsLookupFn: mockDns
  });

  assert.equal(validation.isSafe, false, 'Mixed public + private resolution must fail-closed');
  assert.ok(validation.reason?.includes('DNS_RESOLUTION_UNSAFE'));
  assert.ok(validation.reason?.includes('192.168.1.100'));
  console.log('[PASS] Test D: Hostname resolves to mixed public + private addresses => blocked');
  passedTests++;
}

// =========================================================================
// TEST E: IPv6 unique-local resolution (fc00::/7, fd00::/8) => blocked
// =========================================================================
{
  const mockDns = async (host) => {
    if (host === 'ipv6-internal-node.com') return ['fd12:3456:789a::1'];
    return [];
  };

  const validation = await validateSafeUrlAndDns('https://ipv6-internal-node.com/manual', {
    dnsLookupFn: mockDns
  });

  assert.equal(validation.isSafe, false, 'IPv6 unique-local resolution must be blocked');
  assert.ok(validation.reason?.includes('DNS_RESOLUTION_UNSAFE'));
  assert.ok(validation.reason?.includes('fd12:3456:789a::1'));
  console.log('[PASS] Test E: IPv6 unique-local resolution => blocked');
  passedTests++;
}

// =========================================================================
// TEST F: Cloud metadata IP resolution (169.254.169.254) => blocked
// =========================================================================
{
  const mockDns = async (host) => {
    if (host === 'metadata-alias.attacker.com') return ['169.254.169.254'];
    return [];
  };

  const validation = await validateSafeUrlAndDns('http://metadata-alias.attacker.com/latest/meta-data', {
    dnsLookupFn: mockDns
  });

  assert.equal(validation.isSafe, false, 'Metadata IP resolution must be blocked');
  assert.ok(validation.reason?.includes('DNS_RESOLUTION_UNSAFE'));
  assert.ok(validation.reason?.includes('169.254.169.254'));
  console.log('[PASS] Test F: Metadata IP resolution => blocked');
  passedTests++;
}

// =========================================================================
// TEST G: Safe initial URL redirects to hostname resolving private => blocked
// =========================================================================
{
  let targetConnected = false;

  const mockDns = async (host) => {
    if (host === 'safe-gateway.org') return ['93.184.216.34'];
    if (host === 'internal-pivot.company.local') return ['10.0.0.12'];
    return [];
  };

  const mockFetch = async (url) => {
    if (url === 'https://safe-gateway.org/redirect') {
      return {
        status: 302,
        headers: new Map([['location', 'https://internal-pivot.company.local/secret-spec']])
      };
    }
    if (url === 'https://internal-pivot.company.local/secret-spec') {
      targetConnected = true;
      return {
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => 'secret leaked'
      };
    }
    return { status: 404 };
  };

  const res = await fetchHttpDocument('https://safe-gateway.org/redirect', {
    fetchFn: mockFetch,
    dnsLookupFn: mockDns,
    maxRedirects: 3
  });

  assert.equal(res.is_blocked, true, 'Redirect to host resolving private must be blocked');
  assert.ok(res.blocked_reason?.includes('SSRF_BLOCKED'));
  assert.equal(targetConnected, false, 'Outbound connection to private target must NEVER occur');
  console.log('[PASS] Test G: Safe initial URL redirects to hostname resolving private => blocked');
  passedTests++;
}

// =========================================================================
// TEST H: Safe URL redirects to another safe public destination => allowed
// =========================================================================
{
  const mockDns = async (host) => {
    if (host === 'initial-publisher.com') return ['93.184.216.34'];
    if (host === 'canonical-repository.org') return ['151.101.1.69'];
    return [];
  };

  const mockFetch = async (url) => {
    if (url === 'https://initial-publisher.com/article-doi-link') {
      return {
        status: 301,
        headers: new Map([['location', 'https://canonical-repository.org/article-full.html']])
      };
    }
    if (url === 'https://canonical-repository.org/article-full.html') {
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => `
          <h1>ASHRAE Standard 62.2 Ventilation and Indoor Air Quality in Residential Buildings</h1>
          <p>Comprehensive engineering specifications for local mechanical exhaust ventilation in residential wet areas and bathrooms.</p>
          <p>Requires minimum intermittent exhaust rate of 50 CFM or continuous exhaust rate of 20 CFM to control peak moisture loading and prevent mold growth.</p>
        `.trim()
      };
    }
    return { status: 404 };
  };

  const res = await fetchHttpDocument('https://initial-publisher.com/article-doi-link', {
    fetchFn: mockFetch,
    dnsLookupFn: mockDns,
    maxRedirects: 3
  });

  assert.equal(res.is_blocked, false, 'Multi-hop safe public redirect must be allowed');
  assert.equal(res.resolved_url, 'https://canonical-repository.org/article-full.html');
  assert.equal(res.retrieval_status, 'SOURCE_RETRIEVED_AND_VERIFIED');
  console.log('[PASS] Test H: Safe URL redirects to another safe public destination => allowed within budget');
  passedTests++;
}

// =========================================================================
// TEST I: Provider URL literal private IP => blocked
// =========================================================================
{
  const literalPrivateUrls = [
    'http://10.0.0.1/report.html',
    'http://172.16.5.1/data',
    'http://192.168.1.1/admin',
    'http://127.0.0.1:8080/metrics',
    'http://100.64.0.1/cgnat',
    'http://[::1]/ipv6-loopback',
    'http://[fe80::1]/link-local'
  ];

  for (const url of literalPrivateUrls) {
    const val = validateSafeUrl(url);
    assert.equal(val.isSafe, false, `Literal private URL '${url}' must be blocked by syntax/IP guard`);

    const res = await fetchHttpDocument(url);
    assert.equal(res.is_blocked, true, `Fetch must reject literal private URL '${url}'`);
    assert.ok(res.blocked_reason?.includes('SSRF_BLOCKED'));
  }

  console.log('[PASS] Test I: Provider URL literal private IP => blocked');
  passedTests++;
}

// =========================================================================
// TEST J: OA resolver URL resolves private => blocked
// =========================================================================
{
  const mockDns = async (host) => {
    if (host === 'oa-campus-repository.net') return ['172.16.8.50'];
    return [];
  };

  const mockCustomOa = async (_doi) => {
    return {
      oa_url: 'https://oa-campus-repository.net/thesis/bathroom_airflow.pdf',
      repository_type: 'INTERNAL_CAMPUS_NET'
    };
  };

  const res = await resolveOpenAccessCandidate('10.1016/j.buildenv.2021.001', 'https://publisher.com/paywall', {
    customOaResolverFn: mockCustomOa,
    dnsLookupFn: mockDns
  });

  assert.equal(res.oa_status, 'OA_BLOCKED_UNSAFE_URL', 'OA URL resolving to private IP must be marked OA_BLOCKED_UNSAFE_URL');
  console.log('[PASS] Test J: OA resolver URL resolves private => blocked');
  passedTests++;
}

console.log(`\n==================================================`);
console.log(`DISCOVERY NETWORK SAFETY SUITE COMPLETE: ${passedTests} PASSED, 0 FAILED`);
console.log(`==================================================\n`);

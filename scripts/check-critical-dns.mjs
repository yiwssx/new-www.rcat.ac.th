/**
 * Read-only DNS drift guard for the institutional hosts, independent of www O2O.
 * Uses two independent HTTPS DNS resolvers to avoid reliance on runner UDP/53.
 * Never modifies any DNS record, Worker Route, firewall or application.
 */
import { appendFileSync } from 'node:fs';

export const EXPECTED_NS = ['kirk.ns.cloudflare.com', 'maria.ns.cloudflare.com'];
export const PROTECTED_HOSTS = ['rms', 'pdf', 'iot', 'radio'];
export const EXPECTED_IP = '202.29.239.145';
export const LOOKUPS = [
  { name: 'Google', endpoint: 'https://dns.google/resolve' },
  { name: 'Cloudflare', endpoint: 'https://cloudflare-dns.com/dns-query' },
];

export function recordsOfType(json, type, name) {
  return [...new Set((json.Answer || [])
    .filter((r) => r.type === type && r.name.toLowerCase().replace(/\.$/, '') === name.toLowerCase())
    .map((r) => r.data.toLowerCase().replace(/\.$/, '')))].sort();
}

export function judgeDns(json, type, name, expected) {
  if (json.Status !== 0) return { ok: false, reason: 'DNS status ' + json.Status, actual: [] };
  const actual = recordsOfType(json, type, name);
  const want = [...expected].sort();
  return {
    ok: actual.join('|') === want.join('|'),
    reason: actual.length ? actual.join(', ') : 'NO ANSWER',
    actual,
  };
}

export async function queryDoH(endpoint, name, type, fetchImpl = fetch) {
  const url = new URL(endpoint);
  url.searchParams.set('name', name);
  url.searchParams.set('type', type);
  const resp = await fetchImpl(url, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!resp.ok) throw new Error('DNS-over-HTTPS status ' + resp.status);
  const body = await resp.json();
  if (typeof body.Status !== 'number' || !Array.isArray(body.Answer)) {
    // NOERROR/NODATA responses may omit Answer; treat only missing Status as invalid.
    if (typeof body.Status !== 'number') throw new Error('Invalid DoH response');
  }
  return body;
}

export async function runDnsGuard({ fetchImpl = fetch, strictAnyflip = false } = {}) {
  const checks = [
    { host: 'rcat.ac.th', type: 'NS', expected: EXPECTED_NS, severity: 'critical' },
    ...PROTECTED_HOSTS.map((short) => ({
      host: short + '.rcat.ac.th', type: 'A', expected: [EXPECTED_IP], severity: 'critical',
    })),
    { host: 'anyflip.rcat.ac.th', type: 'A', expected: [EXPECTED_IP], severity: strictAnyflip ? 'critical' : 'warning' },
  ];
  let failed = 0;
  const lines = ['| DNS endpoint | Host | Type | Answer | Status |', '| --- | --- | --- | --- | --- |'];
  for (const check of checks) {
    const outcomes = await Promise.all(LOOKUPS.map(async ({ name, endpoint }) => {
      try {
        const answer = await queryDoH(endpoint, check.host, check.type, fetchImpl);
        return { resolver: name, ...judgeDns(answer, check.type === 'NS' ? 2 : 1, check.host, check.expected) };
      } catch (e) {
        return { resolver: name, ok: false, reason: 'UNAVAILABLE: ' + String(e?.message || e), actual: [] };
      }
    }));
    for (const r of outcomes) {
      const flag = r.ok ? 'PASS' : (check.severity === 'warning' ? 'WARNING' : 'CRITICAL');
      console.log(flag + ' ' + r.resolver + ' ' + check.host + ' ' + check.type + ' => ' + r.reason);
      lines.push('| ' + r.resolver + ' | ' + check.host + ' | ' + check.type + ' | ' + r.reason.replaceAll('|', '/') + ' | ' + flag + ' |');
      if (!r.ok && check.severity === 'critical') failed++;
      if (!r.ok && check.severity === 'warning') console.log('::warning::AnyFlip DNS does not match the expected RMS IPv4 origin (incident #786)');
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## RCAT DNS isolation guard (read only)\n\n' + lines.join('\n') + '\n\n');
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  runDnsGuard({ strictAnyflip: process.env.RCAT_ANYFLIP_DNS_STRICT === 'true' })
    .then((exitCode) => { process.exitCode = exitCode; })
    .catch((err) => { console.error('DNS guard failed:', err); process.exitCode = 1; });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeDns, runDnsGuard, recordsOfType } from './check-critical-dns.mjs';

function answer(name, type, values) {
  const types = { A: 1, NS: 2, MX: 15, TXT: 16, AAAA: 28 };
  return { Status: 0, Answer: values.map((data) => ({ name: name + '.', type: types[type], data, TTL: 64 })) };
}
const A = (name, values) => ({ name, type: 'A', policy: 'exact', expected: values, severity: 'critical', owner: 'institution' });
const logger = { log() {}, warn() {} };

test('TTL 64 is irrelevant to DNS response integrity', () => {
  assert.equal(judgeDns(answer('rms.rcat.ac.th','A',['202.29.239.145']), A('rms.rcat.ac.th',['202.29.239.145'])).ok,true);
});
test('Answers are matched by exact hostname and resource record type', () => {
  const data = { Status: 0, Answer: [{name:'www.rcat.ac.th.',type:1,data:'104.21.24.8'},{name:'rms.rcat.ac.th.',type:1,data:'202.29.239.145'}] };
  assert.deepEqual(recordsOfType(data,'A','rms.rcat.ac.th'), ['202.29.239.145']);
});
test('Cloudflare IP instead of institutional origin is drift', () => {
  assert.equal(judgeDns(answer('rms.rcat.ac.th','A',['104.21.24.8']), A('rms.rcat.ac.th',['202.29.239.145'])).ok,false);
});
test('Mail MX and SPF TXT are monitored independently of verification tokens', () => {
  assert.equal(judgeDns(answer('rcat.ac.th','MX',['10 alt3.aspmx.l.google.com.']), {name:'rcat.ac.th',type:'MX',policy:'exact',expected:['10 alt3.aspmx.l.google.com']}).ok,true);
  assert.equal(judgeDns(answer('rcat.ac.th','TXT',['"verification-token"','"v=spf1 include:_spf.google.com ~all"']), {name:'rcat.ac.th',type:'TXT',policy:'contains',expected:['v=spf1 include:_spf.google.com ~all']}).ok,true);
});
test('Inventory can protect newly registered names, not just RMS', async () => {
  const config={version:1,checks:[A('other.rcat.ac.th',['203.0.113.14'])]};
  const fetchImpl = async (url)=>({ok:true,json:async()=>answer(new URL(url).searchParams.get('name'),'A',['104.21.24.8'])});
  assert.equal(await runDnsGuard({config,fetchImpl,logger}),1);
});
test('Known AnyFlip incident warns until DNS remediation validated', async () => {
  const config={version:1,checks:[{...A('anyflip.rcat.ac.th',['202.29.239.145']),owner:'incident-786',severity:'warning'}]};
  const fetchImpl=async(url)=>({ok:true,json:async()=>answer(new URL(url).searchParams.get('name'),'A',['104.21.24.8'])});
  assert.equal(await runDnsGuard({config,fetchImpl,logger}),0);
  assert.equal(await runDnsGuard({config,fetchImpl,logger,strictAnyflip:true}),1);
});
test('Unexpected active authoritative nameservers are critical', () => {
  assert.equal(judgeDns(answer('rcat.ac.th','NS',['maria.ns.cloudflare.com','attacker.ns.cloudflare.com']), {name:'rcat.ac.th',type:'NS',policy:'exact',expected:['maria.ns.cloudflare.com','kirk.ns.cloudflare.com']}).ok,false);
});

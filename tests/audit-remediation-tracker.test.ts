import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

try {
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');

  includes(tracker, '# Attestor Audit Remediation Tracker', 'Tracker: title is present');
  includes(tracker, 'not a certification', 'Tracker: no-certification disclaimer is present');
  includes(tracker, '`origin/master` is the source of truth', 'Tracker: origin/master rule is present');
  includes(tracker, 'Remaining work after the final claim-alignment slice: 0 planned', 'Tracker: final remaining estimate is explicit');
  includes(tracker, 'Remaining F6 queue after recipient/tenant runtime boundary bridge: 0 planned', 'Tracker: F6 remaining estimate is explicit');
  includes(tracker, 'Remaining F7 queue after shadow readiness and claim alignment: 0 planned', 'Tracker: F7 remaining estimate is explicit');
  includes(tracker, 'Remaining F8 queue after operational resilience validation: 0 planned', 'Tracker: F8 remaining estimate is explicit');
  includes(tracker, 'Remaining F9 queue after compliance gap validation: 0 planned', 'Tracker: F9 remaining estimate is explicit');
  includes(tracker, 'Remaining F10 queue after escape-hatch validation: 0 planned', 'Tracker: F10 remaining estimate is explicit');
  includes(tracker, 'Remaining F11 queue after supply-chain depth validation: 0 planned', 'Tracker: F11 remaining estimate is explicit');
  includes(tracker, 'Remaining F12 queue after continuous red-team validation: 0 planned', 'Tracker: F12 remaining estimate is explicit');

  for (const pr of [
    '#220',
    '#291',
    '#292',
    '#293',
    '#294',
    '#295',
    '#296',
    '#297',
    '#298',
    '#299',
    '#300',
    '#301',
    '#302',
    '#303',
    '#304',
    '#305',
    '#306',
    '#307',
    '#308',
    '#309',
    '#310',
    '#311',
    '#312',
    '#313',
    '#314',
    '#315',
    '#316',
    '#317',
    '#318',
    '#319',
    '#320',
    '#321',
    '#322',
    '#323',
    '#324',
    '#325',
    '#326',
    '#327',
  ]) {
    includes(tracker, pr, `Tracker: ${pr} is referenced`);
  }

  for (const group of [
    'F1 Threat-Model Foundation',
    'F2 Agentic Consequence Surface',
    'F3 Cross-Cutting Guard Readiness',
    'F4 OWASP LLM / Input Surface Redo',
    'F5 Signing Layer',
    'Final Docs And Claim Alignment',
    'F6 Multi-Tenant Blast Radius',
    'F7 Shadow Infrastructure Red-Team',
    'F8 Operational Resilience / Chaos',
    'F9 Compliance Gap Analysis',
    'F10 Customer Escape-Hatch Abuse',
    'F11 Supply Chain Depth',
    'F12 Continuous Red-Team Automation',
  ]) {
    includes(tracker, group, `Tracker: ${group} section exists`);
  }

  includes(tracker, 'F2-AG-4 multi-agent delegation confusion', 'Tracker: completed F2 remediation is named');
  includes(tracker, 'F1-CC-3 cross-vector replay correlation | `backlog` | F1 Backlog Closure Validation', 'Tracker: F1 replay correlation backlog is evidence-qualified');
  includes(tracker, 'F1-CC-4 data-minimization fan-out | `backlog` | F1 Backlog Closure Validation', 'Tracker: F1 data-minimization fan-out backlog is evidence-qualified');
  includes(tracker, 'F1-CC-6 cross-log integrity anchor | `accepted-limitation` | F1 Backlog Closure Validation', 'Tracker: F1 cross-log integrity boundary is accepted');
  includes(tracker, 'F2-AG-1 customer-gate honor-system | `partial`', 'Tracker: F2 customer-gate validation is closed as partial');
  includes(tracker, 'signed bearer and release-enforcement customer-gate verifiers', 'Tracker: F2 customer-gate signed bearer verifier is recorded');
  includes(tracker, 'protected release-enforcement verifier-consumer path', 'Tracker: F2 customer-gate release-enforcement verifier consumer is recorded');
  includes(tracker, 'customer PEP runtime adoption proof in `src/consequence-admission/customer-pep-runtime-adoption.ts`', 'Tracker: F2 customer PEP runtime adoption proof is recorded');
  includes(tracker, 'hosted route proof in `src/service/generic-admission-protected-route.ts`', 'Tracker: F2 hosted generic route proof is recorded');
  includes(tracker, 'hosted DPoP sender-confirmation bridge in `src/service/hosted-generic-admission-sender-confirmation.ts`', 'Tracker: F2 hosted DPoP sender-confirmation bridge is recorded');
  includes(tracker, 'hosted durable introspection/replay wiring through `src/service/release-token-introspection-store.ts`', 'Tracker: F2 hosted durable introspection bridge is recorded');
  includes(tracker, 'shared DPoP proof replay store in `src/service/hosted-generic-admission-dpop-proof-replay-store.ts`', 'Tracker: F2 shared hosted DPoP proof replay store is recorded');
  includes(tracker, 'consumes token-request DPoP proof jti values in runtime-local profiles or the PostgreSQL shared replay store', 'Tracker: F2 hosted DPoP proof replay consumption is recorded');
  includes(tracker, 'shared DPoP sender-proof replay storage is absent', 'Tracker: F2 hosted DPoP proof replay blocker is recorded');
  includes(tracker, 'registers issued protected tokens in the release-token introspection authority', 'Tracker: F2 issued-token introspection registration is recorded');
  includes(tracker, 'external KMS/HSM issuer boundary with structured live provider proof', 'Tracker: F2 hosted issuer external live-proof boundary is recorded');
  includes(tracker, 'F2-AG-2 agent-payment settlement post-condition | `partial`', 'Tracker: F2 agent-payment settlement validation is closed as partial');
  includes(tracker, 'F2-AG-3 account-delegation / EIP-7702 scope | `partial`', 'Tracker: F2 EIP-7702 scope validation is closed as partial');
  includes(tracker, 'F2-AG-5 hidden downstream side effects / receipt omission | `partial`', 'Tracker: F2 downstream receipt omission validation is closed as partial');
  includes(tracker, 'F2-AG-6 unsupported confidence / hallucinated evidence | `partial`', 'Tracker: F2 evidence confidence validation is closed as partial');
  includes(tracker, 'F2-AG-7 agentic supply-chain and LLM provider dependency | `partial`', 'Tracker: F2 LLM provider supply-chain validation is closed as partial');
  includes(tracker, 'F2-AG-8 multimodal vision input future risk | `backlog`', 'Tracker: F2 multimodal vision future risk is backlogged');
  includes(tracker, 'F2-AG-9 free-text narrow constraints | `fixed`', 'Tracker: F2 constraint kind registry validation is fixed');
  includes(tracker, 'F2-AG-10 model/tool/config drift | `partial`', 'Tracker: F2 model/tool/config drift validation is closed as partial');
  includes(tracker, 'F3-CC-10 agentic supply-chain guard missing', 'Tracker: final F3 item is tracked');
  includes(tracker, 'F4-LLM10-B retry-attempt ledger storage claim', 'Tracker: detailed F4 redo is tracked');
  includes(tracker, 'F4-LLM09-A hallucinated evidence / unsupported confidence | `partial`', 'Tracker: F4 LLM09 evidence confidence validation is closed as partial');
  includes(tracker, 'F4-LLM01-A indirect prompt injection via operator-asserted trust class | `fixed`', 'Tracker: F4 trust class PKI proof validation is fixed');
  includes(tracker, 'F4-LLM01-B hosted LLM agent tool boundary descriptor-only | `invalid-as-stated`', 'Tracker: F4 hosted LLM boundary conformance is invalid as stated');
  includes(tracker, 'F4-LLM02-A data-minimization evaluation operator-driven | `fixed`', 'Tracker: F4 data minimization scanning is fixed');
  includes(tracker, 'F4-LLM02-B redaction policy not activated as an enforcement claim | `accepted-limitation`', 'Tracker: F4 data minimization readiness boundary is accepted');
  includes(tracker, 'F4-LLM05-A presentation freshness relies on operator clock | `fixed`', 'Tracker: F4 presentation freshness nonce is fixed');
  includes(tracker, 'F4-LLM05-B presentation replay ledger in-memory reference path | `partial`', 'Tracker: F4 replay shared-ledger validation is partial');
  includes(tracker, 'consequence shared-store request guard', 'Tracker: consequence shared-store request guard bridge is tracked');
  includes(tracker, 'generic high-risk protected release-token issuance contract', 'Tracker: generic protected release-token issuance contract is tracked');
  includes(tracker, 'hosted bootstrap requires the protected issuer route, validates token-request DPoP proof', 'Tracker: F4 hosted protected route DPoP narrowing is tracked');
  includes(tracker, 'can use the PostgreSQL shared DPoP proof replay store after production-shared shared-authority cutover', 'Tracker: F4 DPoP proof replay shared store is tracked');
  includes(tracker, 'customer PEP runtime adoption can be proven for a scoped runtime', 'Tracker: F4 customer PEP runtime adoption narrowing is tracked');
  includes(tracker, 'F4-LLM06-B agent-loop budget per process | `partial`', 'Tracker: F4 shared agent-loop validation is partial');
  includes(tracker, 'F4-LLM03-A agentic supply-chain coverage gap / single LLM provider | `partial`', 'Tracker: F4 LLM03 provider split is closed as partial');
  includes(tracker, 'route-readiness evidence gating', 'Tracker: F4 LLM provider route-readiness evidence gate is tracked');
  includes(tracker, 'F4-LLM10-A velocity limits depend on shared counter enforcement | `partial`', 'Tracker: F4 velocity source validation is partial');
  includes(tracker, 'F4-LLM10-B retry-attempt ledger storage claim | `partial`', 'Tracker: F4 retry ledger storage validation is partial');
  includes(tracker, 'F4-LLM07-A prompt leakage second-pass markers missing | `fixed`', 'Tracker: F4 prompt leakage marker validation is fixed');
  includes(tracker, 'F4 Prompt Leakage Marker Validation', 'Tracker: F4 prompt leakage marker validation evidence is linked');
  includes(tracker, 'F4-D Attestor-owned OpenAI usage / budget / prompt leakage scope | `partial`', 'Tracker: F4-D OpenAI usage is partial');
  includes(tracker, 'F5-A6 transparency log missing | `accepted-limitation`', 'Tracker: F5 transparency limitation is accepted');
  includes(tracker, 'F5 Transparency Log Claim Boundary Validation', 'Tracker: F5 transparency claim boundary evidence is linked');
  includes(tracker, 'F5-B1 crypto-authorization adapter trust delegation | `accepted-limitation`', 'Tracker: F5 crypto trust-delegation boundary is accepted');
  includes(tracker, 'F5 Crypto Trust Delegation Boundary Validation', 'Tracker: F5 crypto trust-delegation validation evidence is linked');
  includes(tracker, 'FINAL-1 README / public docs claim alignment | `fixed`', 'Tracker: final README/docs alignment is fixed');
  includes(tracker, 'FINAL-2 research provenance / remediation ledger sync | `fixed`', 'Tracker: final provenance sync is fixed');
  includes(tracker, 'Final Claim Alignment Validation', 'Tracker: final claim-alignment validation evidence is linked');
  includes(tracker, 'The current F1-F5 project-owner supplied audit queue is closed for repository', 'Tracker: F1-F5 queue closure is explicit');
  includes(tracker, 'F6 is closed for planned repository slices', 'Tracker: F6 closure is explicit');
  includes(tracker, 'F7 is closed for planned repository slices', 'Tracker: F7 closure is explicit');
  includes(tracker, 'F6-T1 shared PKI tenant binding | `partial`', 'Tracker: F6-T1 status is tracked');
  includes(tracker, 'provider-native algorithm/input-mode capability', 'Tracker: F6 tenant signer provider capability boundary is tracked');
  includes(tracker, 'F6-T2 RLS declared but not data-path wired | `accepted-limitation`', 'Tracker: F6-T2 status is tracked');
  includes(tracker, 'F6-T3 env tenant key registry per-pod cache | `partial`', 'Tracker: F6-T3 status is tracked');
  includes(tracker, 'F6-T4 usage-meter single-node quota | `partial`', 'Tracker: F6-T4 status is tracked');
  includes(tracker, 'F6-T5 bypass route tenant-header spoofing | `fixed`', 'Tracker: F6-T5 status is tracked');
  includes(tracker, 'F6-T6 runtime signer all-tenant blast radius | `partial`', 'Tracker: F6-T6 status is tracked');
  includes(tracker, 'unsupported provider/algorithm rejection', 'Tracker: F6 signer capability rejection is tracked');
  includes(tracker, 'F6-T7 anonymous fallback env-gated | `invalid-as-stated`', 'Tracker: F6-T7 status is tracked');
  includes(tracker, 'F6-T8 recipient/tenant boundary replay-only | `partial`', 'Tracker: F6-T8 status is tracked');
  includes(tracker, 'F6-T9 plaintext env API keys in memory | `fixed`', 'Tracker: F6-T9 status is tracked');
  includes(tracker, 'F6-T10 `default` tenant sentinel collision | `fixed`', 'Tracker: F6-T10 status is tracked');
  includes(tracker, 'F7-S1 shadow event injection without origin-binding | `fixed`', 'Tracker: F7-S1 status is tracked');
  includes(tracker, 'F7-S2 operator-supplied redaction self-attest | `fixed`', 'Tracker: F7-S2 status is tracked');
  includes(tracker, 'F7-S3 simulation window / threshold manipulation | `fixed`', 'Tracker: F7-S3 status is tracked');
  includes(tracker, 'F7-S4 break-glass rollout has no extra gate | `fixed`', 'Tracker: F7-S4 status is tracked');
  includes(tracker, 'F7-S5 customer controls readiness aggregation | `invalid-as-stated`', 'Tracker: F7-S5 status is tracked');
  includes(tracker, 'F7-S6 shadow persistence per-node single-host | `accepted-limitation`', 'Tracker: F7-S6 status is tracked');
  includes(tracker, 'F7-S7 red-team replay is not runtime enforcement | `accepted-limitation`', 'Tracker: F7-S7 status is tracked');
  includes(tracker, 'F7-S8 single-operator shadow activation | `fixed`', 'Tracker: F7-S8 status is tracked');
  includes(tracker, 'F7-S9 shadow bundle signing boundary | `fixed`', 'Tracker: F7-S9 status is tracked');
  includes(tracker, 'F7-S10 production-ready descriptor enforcement | `fixed`', 'Tracker: F7-S10 status is tracked');
  includes(tracker, 'F7 Shadow Readiness Claim Alignment Validation', 'Tracker: F7 readiness validation evidence is linked');
  includes(tracker, 'F8-R1 health PKI fingerprint / subject disclosure | `fixed`', 'Tracker: F8-R1 status is tracked');
  includes(tracker, 'F8-R2 startup probe separation | `fixed`', 'Tracker: F8-R2 status is tracked');
  includes(tracker, 'F8-R3 health body diagnostic richness | `fixed`', 'Tracker: F8-R3 status is tracked');
  includes(tracker, 'F8-R4 degraded-mode TTL ceiling | `fixed`', 'Tracker: F8-R4 status is tracked');
  includes(tracker, 'F8-R5 async dead-letter HA visibility | `partial`', 'Tracker: F8-R5 status is tracked');
  includes(tracker, 'F8-R6 worker shutdown readiness | `fixed`', 'Tracker: F8-R6 status is tracked');
  includes(tracker, 'F8-R7 PKI bootstrap idempotency / shared lock | `partial`', 'Tracker: F8-R7 status is tracked');
  includes(tracker, 'F8-R8 PostgreSQL pool retry / circuit-breaker policy | `backlog`', 'Tracker: F8-R8 status is tracked');
  includes(tracker, 'F8-R9 degraded-mode clock skew | `accepted-limitation`', 'Tracker: F8-R9 status is tracked');
  includes(tracker, 'F8-R10 automated chaos drill suite | `partial`', 'Tracker: F8-R10 status is tracked');
  includes(tracker, 'F8-R11 production-shared startup fail-fast | `fixed`', 'Tracker: F8-R11 status is tracked');
  includes(tracker, 'F8-R12 webhook signature route proof | `fixed`', 'Tracker: F8-R12 status is tracked');
  includes(tracker, 'F8 Operational Resilience Validation', 'Tracker: F8 validation evidence is linked');
  includes(tracker, 'F8 is closed for planned repository slices', 'Tracker: F8 closure is explicit');
  includes(tracker, 'F9 compliance gap analysis | 12 | 11 | 1 | 0', 'Tracker: F9 count row is tracked');
  includes(tracker, 'F9-C1 SOC 2 / ISO 27001 / ISO 42001 mapping docs missing | `fixed`', 'Tracker: F9-C1 status is tracked');
  includes(tracker, 'F9-C2 SOC 2 Type II evidence-pack implication | `accepted-limitation`', 'Tracker: F9-C2 status is tracked');
  includes(tracker, 'F9-C3 data-residency / regional-pinning posture missing | `fixed`', 'Tracker: F9-C3 status is tracked');
  includes(tracker, 'F9-C4 retention/disposal policy missing | `fixed`', 'Tracker: F9-C4 status is tracked');
  includes(tracker, 'F9-C5 segregation-of-duties policy missing | `fixed`', 'Tracker: F9-C5 status is tracked');
  includes(tracker, 'F9-C6 vendor / third-party provider risk doc missing | `fixed`', 'Tracker: F9-C6 status is tracked');
  includes(tracker, 'F9-C7 BC/DR policy doc RTO/RPO posture unclear | `fixed`', 'Tracker: F9-C7 status is tracked');
  includes(tracker, 'F9-C8 accessibility / AI bias posture missing | `fixed`', 'Tracker: F9-C8 status is tracked');
  includes(tracker, 'F9-C9 security-testing / pentest posture undocumented | `fixed`', 'Tracker: F9-C9 status is tracked');
  includes(tracker, 'F9-C10 cryptography / key-management policy doc missing | `fixed`', 'Tracker: F9-C10 status is tracked');
  includes(tracker, 'F9-C11 privacy notice / data-flow template missing | `fixed`', 'Tracker: F9-C11 status is tracked');
  includes(tracker, 'F9-C12 shared-responsibility model implicit | `fixed`', 'Tracker: F9-C12 status is tracked');
  includes(tracker, 'F9 Compliance Gap Validation', 'Tracker: F9 validation evidence is linked');
  includes(tracker, 'F9 is closed for planned repository', 'Tracker: F9 closure is explicit');
  includes(tracker, 'F10 customer escape-hatch abuse | 12 | 8 | 4 | 0', 'Tracker: F10 count row is tracked');
  includes(tracker, 'F10-E1 legacy flat verify reason missing | `fixed`', 'Tracker: F10-E1 status is tracked');
  includes(tracker, 'F10-E2 `requireProof: false` telemetry gap | `fixed`', 'Tracker: F10-E2 status is tracked');
  includes(tracker, 'F10-E3 break-glass rollout lacks distinct gate | `fixed`', 'Tracker: F10-E3 status is tracked');
  includes(tracker, 'F10-E4 natural-language bypass caller-asserted | `partial`', 'Tracker: F10-E4 status is tracked');
  includes(tracker, 'F10-E5 OIDC insecure HTTP production gate | `fixed`', 'Tracker: F10-E5 status is tracked');
  includes(tracker, 'F10-E6 shared `accept-the-risk` string | `accepted-limitation`', 'Tracker: F10-E6 status is tracked');
  includes(tracker, 'F10-E7 fallback key-source health visibility | `fixed`', 'Tracker: F10-E7 status is tracked');
  includes(tracker, 'F10-E8 local-dev profile production fallback | `invalid-as-stated`', 'Tracker: F10-E8 status is tracked');
  includes(tracker, 'F10-E9 exported `resetKeylessCa` | `fixed`', 'Tracker: F10-E9 status is tracked');
  includes(tracker, 'F10-E10 degraded-mode TTL escape | `fixed`', 'Tracker: F10-E10 status is tracked');
  includes(tracker, 'F10-E11 shared counter default | `partial`', 'Tracker: F10-E11 status is tracked');
  includes(tracker, 'F10-E12 aggregate escape-hatch usage view | `partial`', 'Tracker: F10-E12 status is tracked');
  includes(tracker, 'F10 Customer Escape-Hatch Abuse', 'Tracker: F10 section is present');
  includes(tracker, 'F11 supply-chain depth | 12 | 7 | 5 | 0', 'Tracker: F11 count row is tracked');
  includes(tracker, 'F11-SC-1 container base images use floating tags | `fixed`', 'Tracker: F11-SC-1 status is tracked');
  includes(tracker, 'F11-SC-2 observability stack uses `:latest` tags | `fixed`', 'Tracker: F11-SC-2 status is tracked');
  includes(tracker, 'F11-SC-3 high-trust npm dependency caret pinning | `fixed`', 'Tracker: F11-SC-3 status is tracked');
  includes(tracker, 'F11-SC-4 single OpenAI provider / provider registry contract | `partial`', 'Tracker: F11-SC-4 status is tracked');
  includes(tracker, 'F11-SC-5 generated-adapter verification path | `partial`', 'Tracker: F11-SC-5 status is tracked');
  includes(tracker, 'F11-SC-6 model drift binding for Attestor-owned OpenAI usage | `partial`', 'Tracker: F11-SC-6 status is tracked');
  includes(tracker, 'F11-SC-7 customer-supplied evidence re-fetch | `partial`', 'Tracker: F11-SC-7 status is tracked');
  includes(tracker, 'F11-SC-8 webhook ingress signature spot-check | `fixed`', 'Tracker: F11-SC-8 status is tracked');
  includes(tracker, 'F11-SC-9 MCP server registry missing | `backlog`', 'Tracker: F11-SC-9 status is tracked');
  includes(tracker, 'F11-SC-10 connector/plugin component criticality | `fixed`', 'Tracker: F11-SC-10 status is tracked');
  includes(tracker, 'F11-SC-11 SBOM packaging not located | `invalid-as-stated`', 'Tracker: F11-SC-11 status is tracked');
  includes(tracker, 'F11-SC-12 release-provenance token boundary | `fixed`', 'Tracker: F11-SC-12 status is tracked');
  includes(tracker, 'F11 Supply Chain Depth', 'Tracker: F11 section is present');
  includes(tracker, 'F12 continuous red-team automation | 12 | 3 | 9 | 0', 'Tracker: F12 count row is tracked');
  includes(tracker, 'F12-RT-1 external AI safety benchmarks cited but not integrated | `backlog`', 'Tracker: F12-RT-1 status is tracked');
  includes(tracker, 'F12-RT-2 no nightly drift / regression cron | `fixed`', 'Tracker: F12-RT-2 status is tracked');
  includes(tracker, 'F12-RT-3 no fuzz harness for canonicalizer / verifier | `partial`', 'Tracker: F12-RT-3 status is tracked');
  includes(tracker, 'F12-RT-4 no cross-finding regression matrix | `partial`', 'Tracker: F12-RT-4 status is tracked');
  includes(tracker, 'F12-RT-5 bug bounty / public VDP missing | `partial`', 'Tracker: F12-RT-5 status is tracked');
  includes(tracker, 'F12-RT-6 red-team fixtures are decision-only, not live runtime | `partial`', 'Tracker: F12-RT-6 status is tracked');
  includes(tracker, 'F12-RT-7 no production-traffic shadow replay for emerging attack patterns | `backlog`', 'Tracker: F12-RT-7 status is tracked');
  includes(tracker, 'F12-RT-8 no public AI safety leaderboard participation | `backlog`', 'Tracker: F12-RT-8 status is tracked');
  includes(tracker, 'F12-RT-9 no pre-merge red-team replay against changed surface | `partial`', 'Tracker: F12-RT-9 status is tracked');
  includes(tracker, 'F12-RT-10 tracker verification scope unverified | `partial`', 'Tracker: F12-RT-10 status is tracked');
  includes(tracker, 'F12-RT-11 external pentest cadence undocumented | `invalid-as-stated`', 'Tracker: F12-RT-11 status is tracked');
  includes(tracker, 'F12-RT-12 coordinated disclosure timeline / SLA not declared | `fixed`', 'Tracker: F12-RT-12 status is tracked');
  includes(tracker, 'F12 is closed for planned repository validation slices', 'Tracker: F12 closure is explicit');
  excludes(tracker, /F12 continuous red-team automation\. Not started\./u, 'Tracker: stale F12 not-started marker is absent');
  includes(tracker, 'F5-A1 out-of-band trust root optional | `fixed`', 'Tracker: F5 CA pin validation is fixed');
  includes(tracker, 'F5 CA Pin Required Validation', 'Tracker: F5 CA pin validation evidence is linked');
  includes(tracker, 'F5-A2 legacy flat verify escape via env | `fixed`', 'Tracker: F5 legacy env downgrade validation is fixed');
  includes(tracker, 'F5 Legacy Env Downgrade Validation', 'Tracker: F5 legacy env downgrade evidence is linked');
  includes(tracker, 'F5-A3 truncated fingerprint width | `fixed`', 'Tracker: F5 fingerprint width validation is fixed');
  includes(tracker, 'F5 Fingerprint Width Validation', 'Tracker: F5 fingerprint width evidence is linked');
  includes(tracker, 'F5-A4 homegrown canonicalization / RFC 8785 interop | `accepted-limitation`', 'Tracker: F5 canonicalization interop boundary is accepted');
  includes(tracker, 'F5-A8 numeric canonicalization edge cases | `fixed`', 'Tracker: F5 numeric canonicalization validation is fixed');
  includes(tracker, 'F5 Canonicalization Validation', 'Tracker: F5 canonicalization validation evidence is linked');
  includes(tracker, 'F-5.2 parent-directory fsync / orphan sweep | `partial`', 'Tracker: F5 file durability validation is partial');
  includes(tracker, 'F5-A5 non-atomic `saveKeyPair` | `fixed`', 'Tracker: F5 key persistence atomicity validation is fixed');
  includes(tracker, 'F5 File Durability And Key Atomicity Validation', 'Tracker: F5 file/key validation evidence is linked');
  includes(tracker, 'F5-A7 module-level CA singleton / injection point | `fixed`', 'Tracker: F5 keyless CA injection boundary is fixed');
  includes(tracker, 'F5-NEW-1 exported `setKeylessCa` runtime injection | `fixed`', 'Tracker: F5 setKeylessCa runtime injection is fixed');
  includes(tracker, 'F5 Keyless CA Injection Boundary Validation', 'Tracker: F5 keyless CA injection evidence is linked');
  includes(tracker, 'F-5.7 HA shared PKI / shared lock | `partial`', 'Tracker: F5 HA shared PKI is narrowed to partial');
  includes(tracker, 'F5-NEW-2 strict PKI path enforcement opt-in | `fixed`', 'Tracker: F5 strict PKI path enforcement is fixed');
  includes(tracker, 'F5 HA Shared PKI Closure Validation', 'Tracker: F5 HA shared PKI closure evidence is linked');
  includes(tracker, 'F5-NEW-3 `allowLegacyUnbounded` escape hatch | `fixed`', 'Tracker: F5 legacy unbounded certificate warning is fixed');
  includes(tracker, 'F5 Legacy Unbounded Certificate Validation', 'Tracker: F5 legacy unbounded certificate evidence is linked');
  includes(tracker, 'F5-NEW-4 duplicate verify helper calls in CLI', 'Tracker: detailed F5 redo is tracked');
  includes(tracker, 'No `needs-revalidation` row can remain before starting F6', 'Tracker: F6 gate is explicit');
  excludes(tracker, /production ready|certified|fully complete/iu, 'Tracker: avoids production/certification overclaim wording');
  includes(packageJson, '"test:audit-remediation-tracker"', 'Package: tracker test script is exposed');
  includes(packageJson, '"test:f4-prompt-leakage-marker-validation"', 'Package: F4 prompt leakage validation script is exposed');
  includes(packageJson, '"test:f5-ca-pin-required-validation"', 'Package: F5 CA pin validation script is exposed');
  includes(packageJson, '"test:f5-legacy-env-downgrade-validation"', 'Package: F5 legacy env downgrade validation script is exposed');
  includes(packageJson, '"test:f5-fingerprint-width-validation"', 'Package: F5 fingerprint width validation script is exposed');
  includes(packageJson, '"test:f5-canonicalization-validation"', 'Package: F5 canonicalization validation script is exposed');
  includes(packageJson, '"test:f5-file-store-key-atomicity-validation"', 'Package: F5 file/key atomicity validation script is exposed');
  includes(packageJson, '"test:f5-keyless-ca-injection-boundary-validation"', 'Package: F5 keyless CA injection validation script is exposed');
  includes(packageJson, '"test:f5-ha-shared-pki-closure-validation"', 'Package: F5 HA shared PKI validation script is exposed');
  includes(packageJson, '"test:f5-legacy-unbounded-certificate-validation"', 'Package: F5 legacy unbounded certificate validation script is exposed');
  includes(packageJson, '"test:f5-transparency-log-claim-boundary-validation"', 'Package: F5 transparency claim boundary validation script is exposed');
  includes(packageJson, '"test:f5-crypto-trust-delegation-boundary-validation"', 'Package: F5 crypto trust-delegation boundary validation script is exposed');
  includes(packageJson, '"test:f1-backlog-closure-validation"', 'Package: F1 backlog closure validation script is exposed');
  includes(packageJson, '"test:final-claim-alignment-validation"', 'Package: final claim-alignment validation script is exposed');
  includes(packageJson, '"test:f6-tenant-blast-radius-validation"', 'Package: F6 tenant blast-radius validation script is exposed');
  includes(packageJson, '"test:f6-tenant-bound-release-token"', 'Package: F6 tenant-bound release-token validation script is exposed');
  includes(packageJson, '"test:f6-tenant-key-cache-hardening"', 'Package: F6 tenant key cache hardening script is exposed');
  includes(packageJson, '"test:f6-anonymous-tenant-sentinel"', 'Package: F6 anonymous tenant sentinel script is exposed');
  includes(packageJson, '"test:f6-bypass-route-tenant-context-invariant"', 'Package: F6 bypass route tenant-context invariant script is exposed');
  includes(packageJson, '"test:f6-rls-claim-alignment"', 'Package: F6 RLS claim alignment script is exposed');
  includes(packageJson, '"test:f6-usage-meter-shared-store-boundary"', 'Package: F6 usage-meter shared-store boundary script is exposed');
  includes(packageJson, '"test:f6-recipient-tenant-runtime-boundary"', 'Package: F6 recipient/tenant runtime boundary script is exposed');
  includes(packageJson, '"test:f7-shadow-infrastructure-validation"', 'Package: F7 shadow infrastructure validation script is exposed');
  includes(packageJson, '"test:f7-shadow-origin-redaction-witness-validation"', 'Package: F7 shadow origin/redaction witness script is exposed');
  includes(packageJson, '"test:f7-shadow-simulation-floor-validation"', 'Package: F7 shadow simulation floor script is exposed');
  includes(packageJson, '"test:f7-break-glass-hardening-validation"', 'Package: F7 break-glass hardening validation script is exposed');
  includes(packageJson, '"test:f7-high-risk-two-person-activation-validation"', 'Package: F7 high-risk two-person activation validation script is exposed');
  includes(packageJson, '"test:f7-shadow-bundle-signing-boundary-validation"', 'Package: F7 shadow bundle signing boundary validation script is exposed');
  includes(packageJson, '"test:shadow-readiness-claim-alignment"', 'Package: shadow readiness claim-alignment script is exposed');
  includes(packageJson, '"test:f7-shadow-readiness-claim-alignment-validation"', 'Package: F7 shadow readiness validation script is exposed');
  includes(packageJson, '"test:f8-operational-resilience-validation"', 'Package: F8 operational resilience validation script is exposed');
  includes(packageJson, '"test:f9-compliance-gap-validation"', 'Package: F9 compliance gap validation script is exposed');
  includes(packageJson, '"test:openai-runtime-policy"', 'Package: OpenAI runtime policy script is exposed');
  includes(packageJson, '"test:openai-live-smoke-proof"', 'Package: OpenAI live smoke proof script is exposed');
  includes(packageJson, '"test:f10-escape-hatch-validation"', 'Package: F10 escape-hatch validation script is exposed');
  includes(packageJson, '"test:f11-supply-chain-depth-validation"', 'Package: F11 supply-chain depth validation script is exposed');
  includes(packageJson, '"test:f12-continuous-red-team-validation"', 'Package: F12 continuous red-team validation script is exposed');
  includes(packageJson, '"test:f12-canonicalizer-fuzz-smoke"', 'Package: F12 canonicalizer fuzz smoke script is exposed');
  includes(packageJson, '"audit:f-series-continuous-validation"', 'Package: F-series continuous validation runner is exposed');

  ok(tracker.split('\n').length > 120, 'Tracker: enough rows to cover supplied audit reports');
  console.log(`Audit remediation tracker tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Audit remediation tracker tests failed:', error);
  process.exitCode = 1;
}

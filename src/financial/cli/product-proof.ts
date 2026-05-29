/**
 * Product proof command for the financial operator CLI.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runPostgresProve } from '../../connectors/postgres-prove.js';
import { buildVerificationKit } from '../../signing/bundle.js';
import { verifyCertificate } from '../../signing/certificate.js';
import { derivePublicKeyIdentity, generateKeyPair, loadPrivateKey, loadPublicKey, type AttestorKeyPair } from '../../signing/keys.js';
import { runFinancialPipeline, type FinancialPipelineInput } from '../pipeline.js';
import { envSet } from './helpers.js';
import { SCENARIOS } from './scenarios.js';

/**
 * Product Proof — the end-to-end attested analytics demonstration.
 *
 * 1. Generates or loads signing key pair
 * 2. Optionally loads or generates reviewer signing key pair
 * 3. Runs a governed financial scenario (fixture or live)
 * 4. Issues a signed Ed25519 attestation certificate
 * 5. If reviewer key is available, endorsement is signed and kit is reviewer-verifiable
 * 6. Verifies the certificate independently
 * 7. Persists all artifacts including the verification kit
 *
 * Usage: attestor prove <scenario-id> [key-dir] [--reviewer-key-dir <dir>]
 *
 * Reviewer key material:
 *   --reviewer-key-dir <dir>  Load reviewer key from <dir>/reviewer-private.pem + reviewer-public.pem
 *   When absent: generates ephemeral reviewer key for local proof demonstration
 */
export async function runProductProof(scenarioId: string, keyDir?: string, reviewerKeyDir?: string, connectorId?: string): Promise<void> {
  console.log(`\n  Attestor Product Proof — Attested Analytics Demonstration`);
  console.log(`  Scenario: ${scenarioId}`);

  // Step 1: Signing key pair (runtime certificate signer)
  let keyPair: AttestorKeyPair;
  if (keyDir) {
    try {
      const privateKeyPem = loadPrivateKey(join(keyDir, 'private.pem'));
      const publicKeyPem = loadPublicKey(join(keyDir, 'public.pem'));
      const identity = derivePublicKeyIdentity(publicKeyPem);
      keyPair = { privateKeyPem, publicKeyPem, ...identity };
      console.log(`  Signing key: loaded from ${keyDir} (fingerprint: ${keyPair.fingerprint})`);
    } catch {
      console.log(`  Key directory ${keyDir} not found. Generating ephemeral key pair...`);
      keyPair = generateKeyPair();
      console.log(`  Signing key: ephemeral (fingerprint: ${keyPair.fingerprint})`);
    }
  } else {
    keyPair = generateKeyPair();
    console.log(`  Signing key: ephemeral (fingerprint: ${keyPair.fingerprint})`);
  }

  // Step 1a-pki: Generate PKI trust chain for this prove run
  const { generatePkiHierarchy } = await import('../../signing/pki-chain.js');
  const pkiHierarchy = generatePkiHierarchy('Attestor CLI CA', 'CLI Runtime Signer', 'CLI Reviewer');
  // Use the PKI signer key as the signing key (PKI-backed by default)
  keyPair = pkiHierarchy.signer.keyPair;
  console.log(`  PKI: CA=${pkiHierarchy.ca.certificate.name}, signer=${pkiHierarchy.signer.certificate.subject}`);

  // Step 1b: Reviewer signing key pair (separate from runtime signer)
  let reviewerKeyPair: AttestorKeyPair | null = null;
  let reviewerKeyMode: 'loaded' | 'ephemeral' | 'absent' = 'absent';
  if (reviewerKeyDir) {
    try {
      const rpk = loadPrivateKey(join(reviewerKeyDir, 'reviewer-private.pem'));
      const rpub = loadPublicKey(join(reviewerKeyDir, 'reviewer-public.pem'));
      const rid = derivePublicKeyIdentity(rpub);
      reviewerKeyPair = { privateKeyPem: rpk, publicKeyPem: rpub, ...rid };
      reviewerKeyMode = 'loaded';
      console.log(`  Reviewer key: loaded from ${reviewerKeyDir} (fingerprint: ${reviewerKeyPair.fingerprint})`);
    } catch {
      console.log(`  Reviewer key directory ${reviewerKeyDir} not usable. Generating ephemeral reviewer key...`);
      reviewerKeyPair = generateKeyPair();
      reviewerKeyMode = 'ephemeral';
      console.log(`  Reviewer key: ephemeral (fingerprint: ${reviewerKeyPair.fingerprint})`);
    }
  } else {
    // Default: generate ephemeral reviewer key for local proof demonstration
    reviewerKeyPair = generateKeyPair();
    reviewerKeyMode = 'ephemeral';
    console.log(`  Reviewer key: ephemeral for local demo (fingerprint: ${reviewerKeyPair.fingerprint})`);
  }

  // Step 1c: Optional OIDC-backed reviewer identity (cache-first)
  let oidcIdentity: import('../types.js').ReviewerIdentity | null = null;
  let oidcTokenPath: 'cached' | 'refreshed' | 'device_flow' | 'none' = 'none';
  const { isOidcConfigured, loadOidcConfig, executeDeviceFlow } = await import('../../identity/oidc-device-flow.js');
  const { loadCachedTokens, saveCachedTokens, isTokenExpired, isTokenExpiringSoon } = await import('../../identity/token-cache.js');
  const { loadSession, saveSession, refreshSession, getSessionBackendName } = await import('../../identity/keychain-session.js');
  // Keychain-first: OS keychain (Windows/macOS/Linux) with encrypted-file fallback.
  const keychainBackend = await getSessionBackendName();
  const loadTokens = async () => {
    const session = await loadSession();
    if (session) return session as any;
    if (process.env.ATTESTOR_PLAINTEXT_TOKEN_IMPORT === '1') {
      const legacy = loadCachedTokens();
      if (legacy) {
        console.log(`  OIDC: importing legacy cache into keychain (${keychainBackend})`);
        await saveSession({ accessToken: legacy.accessToken ?? '', refreshToken: legacy.refreshToken ?? null, idToken: legacy.idToken ?? null, expiresAt: legacy.expiresAt ?? 0, issuer: legacy.issuer ?? '', subject: legacy.subject ?? '', name: legacy.name ?? '', email: legacy.email ?? null, backendUsed: keychainBackend });
        return legacy;
      }
    }
    return null;
  };
  const saveTokens = async (tokens: any) => {
    await saveSession({ accessToken: tokens.accessToken ?? '', refreshToken: tokens.refreshToken ?? null, idToken: tokens.idToken ?? null, expiresAt: tokens.expiresAt ?? 0, issuer: tokens.issuer ?? '', subject: tokens.subject ?? '', name: tokens.name ?? '', email: tokens.email ?? null, backendUsed: keychainBackend });
    if (process.env.ATTESTOR_PLAINTEXT_TOKEN_FALLBACK === '1') {
      saveCachedTokens(tokens);
    }
  };

  if (isOidcConfigured()) {
    const oidcConfig = loadOidcConfig()!;
    console.log(`\n  OIDC: configured (${oidcConfig.issuerUrl})`);

    // 1. Try cached tokens first
    const cached = await loadTokens();
    if (cached && !isTokenExpired(cached)) {
      oidcIdentity = { name: cached.name ?? 'Cached User', role: 'oidc_authenticated', identifier: cached.email ?? cached.subject, signerFingerprint: null };
      oidcTokenPath = 'cached';
      console.log(`  OIDC: using cached identity — ${oidcIdentity.name} (${oidcIdentity.identifier})`);

      // 1b. Refresh if expiring soon
      if (isTokenExpiringSoon(cached)) {
        console.log(`  OIDC: token expiring soon, attempting refresh...`);
        const refreshed = await refreshSession(cached, oidcConfig.clientId);
        if (refreshed) {
          await saveTokens(refreshed);
          oidcIdentity = { name: refreshed.name ?? cached.name ?? 'Refreshed User', role: 'oidc_authenticated', identifier: refreshed.email ?? refreshed.subject, signerFingerprint: null };
          oidcTokenPath = 'refreshed';
          console.log(`  OIDC: token refreshed successfully`);
        }
      }
    } else if (cached && isTokenExpired(cached) && cached.refreshToken) {
      // 2. Expired but has refresh token — try refresh
      console.log(`  OIDC: cached token expired, attempting refresh...`);
      const refreshed = await refreshSession(cached, oidcConfig.clientId);
      if (refreshed) {
        await saveTokens(refreshed);
        oidcIdentity = { name: refreshed.name ?? 'Refreshed User', role: 'oidc_authenticated', identifier: refreshed.email ?? refreshed.subject, signerFingerprint: null };
        oidcTokenPath = 'refreshed';
        console.log(`  OIDC: token refreshed — ${oidcIdentity.name}`);
      }
    }

    // 3. Fall back to interactive device flow
    if (!oidcIdentity) {
      console.log(`  OIDC: no valid cached token, starting device flow...`);
      const oidcResult = await executeDeviceFlow(oidcConfig);
      if (oidcResult.success && oidcResult.identity) {
        oidcIdentity = oidcResult.identity;
        oidcTokenPath = 'device_flow';
        // Save real token material for cache/refresh
        await saveTokens({
          accessToken: oidcResult.accessToken ?? '',
          idToken: oidcResult.idToken ?? null,
          refreshToken: oidcResult.refreshToken ?? null,
          expiresAt: oidcResult.expiresAt ?? (Date.now() / 1000 + 3600),
          issuer: oidcResult.issuer ?? oidcConfig.issuerUrl,
          subject: oidcResult.subject ?? '',
          name: oidcIdentity.name, email: oidcIdentity.identifier,
        });
        if (!oidcResult.refreshToken) {
          console.log(`  OIDC: note — IdP did not issue a refresh token. Future sessions will require interactive login.`);
        }
        if (false) { // removed old block
        }
        console.log(`  OIDC: authenticated via device flow — ${oidcIdentity.name}`);
      } else {
        console.log(`  OIDC: device flow failed — ${oidcResult.error}. Using ephemeral identity.`);
      }
    }

    if (oidcTokenPath !== 'none') {
      console.log(`  OIDC token path: ${oidcTokenPath}`);
    }
  }

  // Step 2: Find scenario
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) {
    console.error(`  Unknown scenario: ${scenarioId}. Use 'list' to see available scenarios.`);
    process.exit(1);
  }
  console.log(`  Intent: ${scenario.description}\n`);

  // Step 3a: Check for explicit connector (e.g., --connector snowflake)
  let connectorExecution: any = null;
  let connectorProvider: string | null = null;
  if (connectorId) {
    const { connectorRegistry } = await import('../../connectors/connector-interface.js');
    const { snowflakeConnector } = await import('../../connectors/snowflake-connector.js');
    if (!connectorRegistry.has('snowflake')) connectorRegistry.register(snowflakeConnector);

    const connector = connectorRegistry.get(connectorId);
    if (!connector) {
      throw new Error(
        `Connector '${connectorId}' not found. Available: ${connectorRegistry.listIds().join(', ')}`,
      );
    } else {
      const connConfig = connector.loadConfig();
      if (!connConfig) {
        throw new Error(`Connector '${connectorId}' not configured (env vars missing)`);
      } else {
        console.log(`  Connector: ${connector.displayName} — attempting execution...`);
        let result;
        try {
          result = await connector.execute(scenario.input.candidateSql, connConfig);
        } catch (err: any) {
          throw new Error(
            `Connector '${connectorId}' execution failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        if (result.success) {
          connectorExecution = result;
          connectorProvider = result.provider;
          console.log(`  Execution: ✓ ${result.provider} — ${result.rowCount} rows in ${result.durationMs}ms`);
          if (result.executionContextHash) {
            console.log(`  Context:   ${result.executionContextHash}`);
          }
        } else {
          throw new Error(
            `Connector '${connectorId}' execution failed: ${result.error ?? 'unknown error'}`,
          );
        }
        console.log('');
      }
    }
  }

  // Step 3b: Check for PostgreSQL-backed execution (only if no explicit connector)
  let pgProveResult: Awaited<ReturnType<typeof runPostgresProve>> | null = null;
  const { reportPostgresReadiness: checkPg, loadPostgresConfig: loadPgConf } = await import('../../connectors/postgres.js');
  const pgReadiness = await checkPg();

  // Detect demo schema mode: when ATTESTOR_PG_ALLOWED_SCHEMAS includes 'attestor_demo',
  // use canonical demo SQL from the bootstrap module instead of regex rewriting.
  const pgConf = loadPgConf();
  const usingDemoSchema = pgConf?.allowedSchemas?.includes('attestor_demo') ?? false;
  let candidateSqlForPg = scenario.input.candidateSql;
  let demoSource: 'canonical' | 'rewrite' | 'none' = 'none';
  if (usingDemoSchema) {
    const { getDemoCounterpartySql } = await import('../../connectors/postgres-demo.js');
    if (scenarioId === 'counterparty') {
      // Use the canonical demo SQL — single source of truth for demo-schema queries
      candidateSqlForPg = getDemoCounterpartySql();
      demoSource = 'canonical';
      console.log(`  Demo mode: using canonical demo SQL for '${scenarioId}' (attestor_demo schema)`);
    } else {
      // No canonical helper for this scenario yet — fall back to schema rewriting
      candidateSqlForPg = candidateSqlForPg.replace(/\brisk\./g, 'attestor_demo.');
      demoSource = 'rewrite';
      console.log(`  Demo mode: rewriting SQL schema references for '${scenarioId}' (risk.* → attestor_demo.*)`);
    }
  }

  if (!pgReadiness.configured) {
    console.log(`  PostgreSQL: not configured (ATTESTOR_PG_URL not set)`);
    console.log(`    Proof will use offline fixture data.`);
    console.log(`    For real DB proof: ${envSet('ATTESTOR_PG_URL', 'postgres://user:pass@host:5432/db')}\n`);
  } else if (!pgReadiness.driverInstalled) {
    console.log(`  PostgreSQL: URL configured but pg driver not installed`);
    console.log(`    Proof will use offline fixture data.`);
    console.log(`    To enable: npm install pg\n`);
  } else {
    console.log(`  PostgreSQL: config present — attempting real database proof path...`);
    pgProveResult = await runPostgresProve(candidateSqlForPg);
    if (pgProveResult.attempted) {
      if (pgProveResult.predictiveGuardrail.performed) {
        console.log(`  Preflight:  ${pgProveResult.predictiveGuardrail.riskLevel} risk (${pgProveResult.predictiveGuardrail.recommendation})`);
        for (const sig of pgProveResult.predictiveGuardrail.signals) {
          console.log(`    ${sig.severity === 'critical' ? '✗' : '⚠'} ${sig.signal}: ${sig.detail}`);
        }
        if (pgProveResult.predictiveGuardrail.recommendation === 'deny') {
          console.log(`  Execution:  DENIED by predictive guardrail — proof falls back to fixture`);
        }
      }
      if (pgProveResult.execution?.success) {
        console.log(`  Execution:  ✓ REAL PostgreSQL — ${pgProveResult.execution.rowCount} rows in ${pgProveResult.execution.durationMs}ms`);
      } else if (pgProveResult.execution) {
        console.log(`  Execution:  ✗ PostgreSQL execution failed: ${pgProveResult.execution.error}`);
        console.log(`    Proof falls back to offline fixture data.`);
      }
    } else {
      console.log(`  PostgreSQL: attempt failed — ${pgProveResult.skipReason}`);
      console.log(`    Proof falls back to offline fixture data.`);
    }
    console.log('');
  }

  // Step 4: Run governed pipeline with signing + reviewer authority (+ Postgres evidence if available)
  // Reviewer approval: when reviewer key pair is available and the scenario needs review,
  // the prove path provides a reviewer endorsement. For low-materiality scenarios that don't
  // require review, reviewer endorsement is still attached to demonstrate the full chain.
  // Use OIDC identity if available, otherwise fall back to ephemeral
  const reviewerName = oidcIdentity?.name ?? (reviewerKeyMode === 'loaded' ? 'Loaded Reviewer' : 'Ephemeral Reviewer');
  const reviewerRole = oidcIdentity?.role ?? 'attestor_operator';
  const reviewerIdentifier = oidcIdentity?.identifier ?? `prove-cli:${reviewerKeyPair?.fingerprint}`;
  const identitySourceLabel = oidcIdentity ? 'oidc_verified' : 'operator_asserted';

  const reviewerApproval: FinancialPipelineInput['approval'] = reviewerKeyPair ? {
    status: 'approved',
    reviewerRole,
    reviewNote: `Product proof reviewer endorsement (${reviewerKeyMode} key, identity: ${identitySourceLabel})`,
    reviewerIdentity: {
      name: reviewerName,
      role: reviewerRole,
      identifier: reviewerIdentifier,
      signerFingerprint: null, // populated by pipeline signing
    },
    reviewerKeyPair,
  } : undefined;

  // When reviewer key is available, force high materiality to trigger the review path.
  // This ensures the endorsement chain is exercised in the product proof.
  let intentOverride = reviewerKeyPair
    ? { ...scenario.input.intent, materialityTier: 'high' as const }
    : { ...scenario.input.intent };

  // In demo mode, also override allowedSchemas so SQL governance accepts attestor_demo.*
  if (usingDemoSchema) {
    intentOverride = { ...intentOverride, allowedSchemas: ['attestor_demo'] };
  }

  const pipelineInput: FinancialPipelineInput = {
    ...scenario.input,
    // In demo mode, use canonical demo SQL (or schema-rewritten fallback) for governance and execution
    candidateSql: usingDemoSchema ? candidateSqlForPg : scenario.input.candidateSql,
    intent: intentOverride,
    signingKeyPair: keyPair,
    // Inject reviewer approval (overrides scenario-level approval if any)
    ...(reviewerApproval ? { approval: reviewerApproval } : {}),
    // Connector-routed execution (e.g., Snowflake)
    ...(connectorExecution ? {
      externalExecution: connectorExecution,
      liveProof: {
        collectedAt: new Date().toISOString(),
        execution: { live: true, provider: connectorProvider!, mode: 'live_db' as const, latencyMs: connectorExecution.durationMs ?? null },
      },
    } : {}),
    // Only pass Postgres execution when it ACTUALLY executed (not denied by preflight)
    ...(!connectorExecution && pgProveResult?.attempted && pgProveResult.execution?.success && !pgProveResult.skipReason ? {
      externalExecution: pgProveResult.execution,
      liveProof: {
        collectedAt: new Date().toISOString(),
        upstream: scenario.input.liveProof?.upstream,
        execution: {
          live: true,
          provider: 'postgres',
          mode: 'live_db' as const,
          latencyMs: pgProveResult.execution.durationMs ?? null,
        },
      },
      predictiveGuardrail: pgProveResult.predictiveGuardrail,
    } : {
      // Preflight-only or denied: pass guardrail result but NOT live execution evidence
      ...(pgProveResult?.predictiveGuardrail ? { predictiveGuardrail: pgProveResult.predictiveGuardrail } : {}),
    }),
  };

  const report = runFinancialPipeline(pipelineInput);

  // Step 4: Display result
  console.log(`  Decision: ${report.decision.toUpperCase()}`);
  console.log(`  Scorers:  ${report.scoring.scorersRun} ran`);
  console.log(`  Warrant:  ${report.warrant.status} (${report.warrant.evidenceObligations.filter((o: any) => o.fulfilled).length}/${report.warrant.evidenceObligations.length} obligations)`);
  console.log(`  Escrow:   ${report.escrow.state}`);
  console.log(`  Receipt:  ${report.receipt?.receiptStatus ?? 'not issued'}`);
  console.log(`  Capsule:  ${report.capsule?.authorityState ?? 'none'}`);
  console.log(`  Audit:    ${report.audit.entries.length} entries, chain ${report.audit.chainIntact ? 'intact' : 'BROKEN'}`);
  console.log(`  Live:     ${report.liveProof.mode}`);

  // Step 5: Proof source truth — explicit about what data backed this run
  const wasRealPg = pgProveResult?.attempted && pgProveResult.execution?.success;
  const wasDenied = pgProveResult?.attempted && pgProveResult.predictiveGuardrail?.recommendation === 'deny';
  if (wasRealPg) {
    const demoLabel = usingDemoSchema ? ' (seeded demo data)' : '';
    console.log(`  Source:   REAL PostgreSQL execution (${pgProveResult!.execution!.rowCount} rows, ${pgProveResult!.execution!.durationMs}ms)${demoLabel}`);
    if (usingDemoSchema) {
      console.log(`  Schema:   attestor_demo (repo-native demo bootstrap, SQL source: ${demoSource})`);
    }
    if (pgProveResult!.postgresEvidence?.executionContextHash) {
      console.log(`  Context:  ${pgProveResult!.postgresEvidence.executionContextHash} (db environment hash)`);
    }
  } else if (wasDenied) {
    console.log(`  Source:   offline fixture (PostgreSQL preflight DENIED execution)`);
  } else if (pgReadiness.configured && !pgReadiness.driverInstalled) {
    console.log(`  Source:   offline fixture (pg driver not installed)`);
  } else if (!pgReadiness.configured) {
    console.log(`  Source:   offline fixture (ATTESTOR_PG_URL not configured)`);
  } else {
    console.log(`  Source:   offline fixture`);
  }

  if (pgProveResult?.predictiveGuardrail?.performed) {
    console.log(`  Preflight: ${pgProveResult.predictiveGuardrail.riskLevel} (${pgProveResult.predictiveGuardrail.signals.length} signals)`);
  }

  // Step 6: Certificate truth
  if (report.certificate) {
    console.log(`\n  ✓ Certificate issued: ${report.certificate.certificateId}`);
    console.log(`    Algorithm:   ${report.certificate.signing.algorithm}`);
    console.log(`    Signer:      ${report.certificate.signing.fingerprint}`);
    console.log(`    Decision:    ${report.certificate.decision}`);

    // Step 6: Independent verification (proves the certificate is self-verifying)
    const verification = verifyCertificate(report.certificate, keyPair.publicKeyPem);
    console.log(`\n  Independent Verification:`);
    console.log(`    Signature:   ${verification.signatureValid ? '✓ valid' : '✗ INVALID'}`);
    console.log(`    Fingerprint: ${verification.fingerprintConsistent ? '✓ consistent' : '✗ MISMATCH'}`);
    console.log(`    Overall:     ${verification.overall === 'valid' ? '✓ VALID' : '✗ ' + verification.overall.toUpperCase()}`);

    // Step 7: Build verification kit with PKI trust chain (self-contained portable proof)
    const kit = buildVerificationKit(
      report, keyPair.publicKeyPem, reviewerKeyPair?.publicKeyPem ?? null,
      pkiHierarchy.chains.signer, pkiHierarchy.ca.keyPair.publicKeyPem,
    );

    // Step 8: Persist artifacts
    // Run-unique proof directory: scenario + timestamp + run ID prefix (no collision, no stale mixing)
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outDir = join('.attestor', 'proofs', `${scenarioId}_${ts}_${report.runId.slice(0, 8)}`);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'certificate.json'), JSON.stringify(report.certificate, null, 2));
    writeFileSync(join(outDir, 'public-key.pem'), keyPair.publicKeyPem);
    if (kit) {
      writeFileSync(join(outDir, 'kit.json'), JSON.stringify(kit, null, 2));
      writeFileSync(join(outDir, 'verification-summary.json'), JSON.stringify(kit.verification, null, 2));
    }
    writeFileSync(join(outDir, 'bundle.json'), JSON.stringify(kit?.bundle ?? {}, null, 2));
    if (reviewerKeyPair) {
      writeFileSync(join(outDir, 'reviewer-public.pem'), reviewerKeyPair.publicKeyPem);
    }
    // PKI trust chain artifact
    writeFileSync(join(outDir, 'trust-chain.json'), JSON.stringify(pkiHierarchy.chains.signer, null, 2));
    writeFileSync(join(outDir, 'ca-public.pem'), pkiHierarchy.ca.keyPair.publicKeyPem);

    console.log(`\n  Artifacts saved to: ${outDir}/`);
    console.log(`    kit.json               — full verification kit (certificate + bundle + summary)`);
    console.log(`    certificate.json       — portable Ed25519-signed attestation certificate`);
    console.log(`    bundle.json            — authority bundle (full governance evidence)`);
    console.log(`    verification-summary.json — 6-dimensional verification result`);
    console.log(`    public-key.pem         — runtime signer public key`);
    if (reviewerKeyPair) {
      console.log(`    reviewer-public.pem    — reviewer signer public key`);
    }
    console.log(`\n  To verify independently:`);
    console.log(`    npx tsx src/signing/verify-cli.ts ${outDir}/kit.json`);
    console.log(`    npx tsx src/signing/verify-cli.ts ${outDir}/certificate.json ${outDir}/public-key.pem`);

    if (kit?.verification) {
      console.log(`\n  Verification Summary:`);
      console.log(`    Crypto:      ${kit.verification.cryptographic.valid ? '✓' : '✗'}`);
      console.log(`    Authority:   ${kit.verification.authority.state}`);
      console.log(`    Governance:  ${kit.verification.governanceSufficiency.sufficient ? 'sufficient' : 'INSUFFICIENT'}`);
      console.log(`    Proof:       ${kit.verification.proofCompleteness.mode} (${kit.verification.proofCompleteness.gapCount} gaps)`);

      // Reviewer endorsement truth
      const re = kit.verification.reviewerEndorsement;
      if (!re.present) {
        console.log(`    Reviewer:    (no endorsement)`);
      } else if (re.verified) {
        console.log(`    Reviewer:    ✓ verified (${re.reviewerName}, ${re.fingerprint}, ${reviewerKeyMode} key)`);
      } else if (re.signed && !re.boundToRun) {
        console.log(`    Reviewer:    ✗ signed but binding mismatch — endorsement NOT bound to this run`);
      } else if (re.signed) {
        console.log(`    Reviewer:    △ signed but not independently verifiable (reviewer key not in kit)`);
      } else {
        console.log(`    Reviewer:    △ present but unsigned`);
      }

      console.log(`    Overall:     ${kit.verification.overall.toUpperCase()}`);
    }
  } else {
    console.log(`\n  ✗ No certificate issued (signing key not provided or pipeline error)`);
  }

  console.log('');
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, forbidden: string, message: string): void {
  assert.ok(!content.includes(forbidden), `${message}\nUnexpected text: ${forbidden}`);
  passed += 1;
}

function testExplicitConnectorFailuresFailClosed(): void {
  const route = readProjectFile('src', 'service', 'http', 'routes', 'pipeline-execution-routes.ts');

  includes(route, "Connector 'postgres-prove' not configured", 'Pipeline connector: postgres-prove config failure is explicit');
  includes(route, "Connector 'postgres-prove' execution failed.", 'Pipeline connector: postgres-prove execution failure is explicit');
  includes(route, "Connector '${body.connector}' execution failed.", 'Pipeline connector: named connector failure is explicit');
  includes(route, "proofMode: 'unavailable'", 'Pipeline connector: failed connector proof mode is unavailable');
  includes(route, '}, 502);', 'Pipeline connector: execution failure returns a 502 response');
  excludes(route, 'fall back to fixture', 'Pipeline connector: explicit connector failure no longer silently falls back to fixture');
}

function testExplicitCliConnectorFailuresFailClosed(): void {
  const cli = [
    readProjectFile('src', 'financial', 'cli.ts'),
    readProjectFile('src', 'financial', 'cli', 'product-proof.ts'),
  ].join('\n');

  includes(cli, "Connector '${connectorId}' not found. Available:", 'CLI connector: missing connector is fatal');
  includes(cli, "Connector '${connectorId}' not configured (env vars missing)", 'CLI connector: missing config is fatal');
  includes(cli, "Connector '${connectorId}' execution failed:", 'CLI connector: thrown execution failure is fatal');
  includes(cli, "Connector '${connectorId}' execution failed: ${result.error ?? 'unknown error'}", 'CLI connector: failed result is fatal');
  excludes(cli, "console.log(`  Connector '${connectorId}' not found. Available: ${connectorRegistry.listIds().join(', ')}`);", 'CLI connector: missing connector is not only logged');
  excludes(cli, "console.log(`  Connector '${connectorId}': not configured (env vars missing)`);", 'CLI connector: missing config is not only logged');
  excludes(cli, 'console.log(`  Execution: ✗ ${result.error}`);', 'CLI connector: failed result is not only logged');
  excludes(cli, 'console.log(`  Execution: ✗ ${err.message}`);', 'CLI connector: thrown execution failure is not only logged');
}

testExplicitConnectorFailuresFailClosed();
testExplicitCliConnectorFailuresFailClosed();

console.log(`Pipeline connector fail-closed tests: ${passed} passed, 0 failed`);

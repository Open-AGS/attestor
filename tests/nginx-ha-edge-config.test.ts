import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function ok(condition: boolean, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: string, message: string): void {
  assert.ok(!content.includes(unexpected), `${message}\nDid not expect to find: ${unexpected}`);
  passed += 1;
}

function run(): void {
  const config = readFileSync(
    join(process.cwd(), 'ops', 'nginx', 'attestor-ha.conf'),
    'utf8',
  );

  includes(
    config,
    'proxy_set_header X-Forwarded-For $remote_addr;',
    'NGINX HA edge config: X-Forwarded-For is overwritten with the direct client address',
  );
  includes(
    config,
    'proxy_set_header X-Real-IP $remote_addr;',
    'NGINX HA edge config: X-Real-IP is set from the direct client address',
  );
  excludes(
    config,
    '$proxy_add_x_forwarded_for',
    'NGINX HA edge config: client-supplied X-Forwarded-For is not appended',
  );
  includes(
    config,
    'clients cannot choose the first hop',
    'NGINX HA edge config: spoofing boundary is documented in the reference config',
  );

  console.log(`NGINX HA edge config tests: ${passed} passed, 0 failed`);
}

run();

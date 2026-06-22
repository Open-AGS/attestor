import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPipelineDeadLetterService,
  type PipelineDeadLetterServiceDeps,
} from '../src/service/application/pipeline-dead-letter-service.js';
import type { AsyncDeadLetterRecord } from '../src/service/async/async-dead-letter-store.js';

const record: AsyncDeadLetterRecord = {
  jobId: 'job_123',
  name: 'pipeline-run',
  backendMode: 'in_process',
  tenantId: 'tenant_123',
  planId: 'trial',
  state: 'failed',
  failedReason: 'boom',
  attemptsMade: 1,
  maxAttempts: 1,
  requestedAt: '2026-04-21T10:00:00.000Z',
  submittedAt: '2026-04-21T10:00:00.000Z',
  processedAt: '2026-04-21T10:00:01.000Z',
  failedAt: '2026-04-21T10:00:01.000Z',
  recordedAt: '2026-04-21T10:00:01.000Z',
};

function createDeps(calls: AsyncDeadLetterRecord[]): PipelineDeadLetterServiceDeps {
  return {
    async upsertDeadLetterRecord(input) {
      calls.push(input);
      return {
        record: input,
        path: '.attestor/async-dlq.json',
      };
    },
  };
}

async function testDeadLetterServiceDelegatesRecordUpsert(): Promise<void> {
  const calls: AsyncDeadLetterRecord[] = [];
  const service = createPipelineDeadLetterService(createDeps(calls));

  const result = await service.record(record);

  assert.equal(result.record.jobId, 'job_123');
  assert.equal(result.path, '.attestor/async-dlq.json');
  assert.deepEqual(calls, [record]);
}

function testAsyncPipelineDeadLetterPersistenceFailuresAreLogged(): void {
  const source = readFileSync(join(process.cwd(), 'src', 'service', 'async', 'async-pipeline.ts'), 'utf8');

  assert.match(
    source,
    /logger\.error\('async\.deadLetter', 'Async dead-letter persistence failed'/,
    'Async pipeline: dead-letter persistence failures emit a structured operator log',
  );
  assert.doesNotMatch(
    source,
    /persistTerminalDeadLetterJob\(job, err\)\.catch\(\(\) => \{\}\)/,
    'Async pipeline: terminal dead-letter persistence failure must not be swallowed silently',
  );
  assert.doesNotMatch(
    source,
    /removeAsyncDeadLetterRecordState\(String\(job\.id\)\)\.catch\(\(\) => \{\}\)/,
    'Async pipeline: completed-job dead-letter cleanup failure must not be swallowed silently',
  );
  assert.match(
    source,
    /errorName: err instanceof Error \? err\.name : typeof err/,
    'Async pipeline: dead-letter failure log uses redacted error classification instead of raw provider bodies',
  );
}

await testDeadLetterServiceDelegatesRecordUpsert();
testAsyncPipelineDeadLetterPersistenceFailuresAreLogged();

console.log('Service pipeline dead letter service tests: 5 passed, 0 failed');

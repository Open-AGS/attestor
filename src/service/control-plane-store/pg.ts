import { CONTROL_PLANE_SCHEMA_SQL } from './schema.js';

export type PgQueryResultRow = Record<string, unknown>;

export type PgClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: PgQueryResultRow[] }>;
  release: () => void;
};

export type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: PgQueryResultRow[] }>;
  connect: () => Promise<PgClient>;
  end: () => Promise<void>;
};

type PgModule = {
  Pool?: new (options: { connectionString: string }) => PgPool;
  default?: {
    Pool?: new (options: { connectionString: string }) => PgPool;
  };
};

let poolPromise: Promise<PgPool> | null = null;
let initPromise: Promise<void> | null = null;

function connectionString(): string | null {
  return process.env.ATTESTOR_CONTROL_PLANE_PG_URL?.trim() || null;
}

export function controlPlaneStoreMode(): 'postgres' | 'file' {
  return connectionString() ? 'postgres' : 'file';
}

export function isSharedControlPlaneConfigured(): boolean {
  return controlPlaneStoreMode() === 'postgres';
}

export function controlPlaneStoreSource(): string | null {
  return connectionString();
}

export function hasControlPlanePgPoolForTests(): boolean {
  return Boolean(poolPromise);
}

export async function getControlPlanePgPool(): Promise<PgPool> {
  const connectionUrl = connectionString();
  if (!connectionUrl) {
    throw new Error('Shared control-plane store is disabled. Set ATTESTOR_CONTROL_PLANE_PG_URL.');
  }
  if (!poolPromise) {
    poolPromise = (async () => {
      const pg = await (Function('return import("pg")')() as Promise<PgModule>);
      const Pool = pg.Pool ?? pg.default?.Pool;
      if (!Pool) {
        throw new Error('pg.Pool is not available for the shared control-plane store.');
      }
      return new Pool({ connectionString: connectionUrl });
    })();
  }
  return poolPromise;
}

export async function ensureControlPlanePgSchema(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const pool = await getControlPlanePgPool();
      await pool.query(CONTROL_PLANE_SCHEMA_SQL);
    })();
  }
  await initPromise;
}

export async function withControlPlanePgTransaction<T>(
  work: (client: PgClient) => Promise<T>,
): Promise<T> {
  await ensureControlPlanePgSchema();
  const pool = await getControlPlanePgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // surface original error
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closeControlPlanePgPoolForTests(): Promise<void> {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.end();
  }
  poolPromise = null;
  initPromise = null;
}

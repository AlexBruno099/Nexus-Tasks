import pg from 'pg';

// Coluna `date` volta como 'YYYY-MM-DD'; sem isso o pg converte para Date no fuso local.
pg.types.setTypeParser(1082, (v) => v);

export const DEFAULT_ADMIN_URL = 'postgres://bobina:bobina@127.0.0.1:5434/bobina';

export function createPool(url = process.env.DATABASE_URL ?? DEFAULT_ADMIN_URL) {
  return new pg.Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
}

export type Db = pg.Pool | pg.PoolClient;

export async function tx<T>(pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

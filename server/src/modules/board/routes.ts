import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { getBoard } from './service';
const query = z.object({ archived: z.enum(['0', '1']).optional() });
export function registerRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get('/api/health', async () => {
    await pool.query('select 1');
    return { ok: true };
  });
  app.get('/api/board', async (req) => getBoard(pool, query.parse(req.query).archived === '1'));
}

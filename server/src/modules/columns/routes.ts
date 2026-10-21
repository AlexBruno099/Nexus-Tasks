import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { params } from '../../http/validation';
import { columnCreate, columnPatch } from './schema';
import * as service from './service';
export function registerRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.post('/api/columns', async (req, reply) =>
    reply.code(201).send(await service.create(pool, columnCreate.parse(req.body))),
  );
  app.patch('/api/columns/:id', async (req) =>
    service.update(pool, params.parse(req.params).id, columnPatch.parse(req.body)),
  );
  app.delete('/api/columns/:id', async (req, reply) => {
    await service.remove(pool, params.parse(req.params).id);
    return reply.code(204).send();
  });
}

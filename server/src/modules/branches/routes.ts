import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { params } from '../../http/validation';
import { branchCreate, branchPatch } from './schema';
import * as service from './service';
export function registerRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.post('/api/branches', async (req, reply) =>
    reply.code(201).send(await service.create(pool, branchCreate.parse(req.body))),
  );
  app.patch('/api/branches/:id', async (req) =>
    service.update(pool, params.parse(req.params).id, branchPatch.parse(req.body)),
  );
  app.delete('/api/branches/:id', async (req, reply) => {
    await service.remove(pool, params.parse(req.params).id);
    return reply.code(204).send();
  });
}

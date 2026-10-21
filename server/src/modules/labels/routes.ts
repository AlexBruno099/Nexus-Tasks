import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { params } from '../../http/validation';
import { labelCreate, labelPatch } from './schema';
import * as service from './service';
export function registerRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.post('/api/labels', async (req, reply) =>
    reply.code(201).send(await service.create(pool, labelCreate.parse(req.body))),
  );
  app.patch('/api/labels/:id', async (req) =>
    service.update(pool, params.parse(req.params).id, labelPatch.parse(req.body)),
  );
  app.delete('/api/labels/:id', async (req, reply) => {
    await service.remove(pool, params.parse(req.params).id);
    return reply.code(204).send();
  });
}

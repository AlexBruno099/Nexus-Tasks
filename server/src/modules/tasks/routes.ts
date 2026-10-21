import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { params } from '../../http/validation';
import { taskCreate, taskMove, taskPatch } from './schema';
import * as service from './service';
export function registerRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.post('/api/tasks', async (req, reply) =>
    reply.code(201).send(await service.create(pool, taskCreate.parse(req.body))),
  );
  app.patch('/api/tasks/:id', async (req) =>
    service.update(pool, params.parse(req.params).id, taskPatch.parse(req.body)),
  );
  app.delete('/api/tasks/:id', async (req, reply) => {
    await service.remove(pool, params.parse(req.params).id);
    return reply.code(204).send();
  });

  app.post('/api/tasks/:id/move', async (req) => {
    const { id } = params.parse(req.params);
    const { columnId, index } = taskMove.parse(req.body);
    return service.move(pool, id, columnId, index);
  });
}

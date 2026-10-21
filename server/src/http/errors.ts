import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      const message = err.issues.map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`).join('; ');
      return reply.code(400).send({ error: message });
    }
    if (err instanceof Error && 'code' in err && err.code === '23505')
      return reply.code(409).send({ error: 'Já existe um item com esse nome.' });
    if (err instanceof Error && 'code' in err && err.code === '23503')
      return reply.code(400).send({ error: 'Coluna, etiqueta ou branch inexistente.' });
    if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: err.message });
    if (
      err instanceof Error &&
      'statusCode' in err &&
      typeof err.statusCode === 'number' &&
      err.statusCode >= 400 &&
      err.statusCode < 500
    )
      return reply.code(err.statusCode).send({ error: err.message });
    app.log.error({ err }, 'Falha ao processar requisição');
    return reply.code(500).send({ error: 'Erro interno do servidor.' });
  });
}

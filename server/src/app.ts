import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type pg from 'pg';
import { registerErrorHandler } from './http/errors';
import { registerRoutes as boardRoutes } from './modules/board/routes';
import { registerRoutes as branchRoutes } from './modules/branches/routes';
import { registerRoutes as columnRoutes } from './modules/columns/routes';
import { registerRoutes as labelRoutes } from './modules/labels/routes';
import { registerRoutes as taskRoutes } from './modules/tasks/routes';

export function buildApp(
  pool: pg.Pool,
  opts: { staticDir?: string; logger?: boolean; logLevel?: string } = {},
) {
  const app = Fastify({
    logger: opts.logger
      ? { level: opts.logLevel ?? 'info', redact: ['req.headers.authorization', 'req.headers.cookie'] }
      : false,
    bodyLimit: 1024 * 1024,
  });
  app.register(helmet, {
    // A aplicação é local por padrão; HTTPS e HSTS são responsabilidade do proxy na publicação.
    strictTransportSecurity: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  });
  registerErrorHandler(app);
  for (const register of [boardRoutes, taskRoutes, branchRoutes, labelRoutes, columnRoutes])
    register(app, pool);
  if (opts.staticDir) app.register(fastifyStatic, { root: opts.staticDir, dotfiles: 'deny' });
  app.setNotFoundHandler((req, reply) => {
    if (
      opts.staticDir &&
      req.method === 'GET' &&
      !req.url.startsWith('/api') &&
      req.headers.accept?.includes('text/html')
    ) {
      return reply.sendFile('index.html', { maxAge: 0, immutable: false });
    }
    return reply.code(404).send({ error: 'Rota não encontrada.' });
  });
  return app;
}

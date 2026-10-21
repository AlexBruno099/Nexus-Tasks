import { z } from 'zod';
export function loadEnvFile() {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL precisa ser uma URL PostgreSQL válida')
    .refine((value) => /^postgres(ql)?:/.test(value)),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  HOST: z.string().min(1).default('127.0.0.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export function readConfig(environment: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(environment);
  if (!result.success)
    throw new Error(
      `Configuração inválida: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}. Execute npm run db:setup no ambiente local.`,
    );
  return result.data;
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config/env';

test('configuração exige URL PostgreSQL e uma porta válida sem mostrar credenciais no erro', () => {
  assert.throws(() => readConfig({}), /DATABASE_URL/);
  assert.throws(() => readConfig({ DATABASE_URL: 'https://example.com/db' }), /Configuração inválida/);
  assert.throws(
    () => readConfig({ DATABASE_URL: 'postgres://runtime:secret@example.com/db', PORT: '0' }),
    (error) => error instanceof Error && error.message.includes('PORT') && !error.message.includes('secret'),
  );
  const config = readConfig({ DATABASE_URL: 'postgres://runtime:secret@127.0.0.1/db' });
  assert.equal(config.HOST, '127.0.0.1');
  assert.equal(config.PORT, 3333);
});

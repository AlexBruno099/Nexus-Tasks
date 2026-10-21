import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { api } from '../src/app/api';
import { ApiError, request } from '../src/shared/api/client';

afterEach(() => mock.restoreAll());

test('resposta 204 não tenta ler JSON', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await request('DELETE', '/tasks/1'), undefined);
});

test('erro HTTP preserva mensagem e status sem ser confundido com erro de rede', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Branch trancada.' }, { status: 409 }));
  await assert.rejects(
    request('PATCH', '/tasks/1', { branchId: null }),
    (error) => error instanceof ApiError && error.status === 409 && error.message === 'Branch trancada.',
  );
});

test('HTML com status 200 não é aceito como dados da API', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('<html>Erro do proxy</html>'));
  await assert.rejects(request('GET', '/board'), /resposta inválida/);
});

test('quadro sem as listas esperadas não chega à renderização', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ ok: true }));
  await assert.rejects(api.board(), /dados do quadro/);
});

test('falha de conexão apresenta mensagem compreensível', async () => {
  mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(request('GET', '/board'), /Não foi possível conectar à API/);
});

test('requisição lenta é cancelada e escrita não é reenviada automaticamente', async () => {
  let calls = 0;
  mock.method(
    globalThis,
    'fetch',
    (_url: unknown, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        calls++;
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
      }),
  );
  await assert.rejects(
    request('POST', '/tasks', { title: 'Task' }, { timeoutMs: 20 }),
    /demorou para responder/,
  );
  assert.equal(calls, 1);
});

test('cancelamento de uma leitura preserva AbortError para o componente ignorar', async () => {
  const controller = new AbortController();
  mock.method(
    globalThis,
    'fetch',
    (_url: unknown, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
      }),
  );
  const result = request('GET', '/board', undefined, { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, (error) => error instanceof DOMException && error.name === 'AbortError');
});

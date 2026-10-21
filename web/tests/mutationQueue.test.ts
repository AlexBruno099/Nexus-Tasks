import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMutationQueue } from '../src/shared/api/mutationQueue';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('escrita seguinte espera a anterior, mesmo se a segunda rede seria mais rápida', async () => {
  const queue = createMutationQueue();
  const firstStarted = deferred();
  const releaseFirst = deferred();
  const events: string[] = [];
  const first = queue.run(async () => {
    events.push('primeira:início');
    firstStarted.resolve();
    await releaseFirst.promise;
    events.push('primeira:fim');
    return 1;
  });
  const second = queue.run(async () => {
    events.push('segunda');
    return 2;
  });
  await firstStarted.promise;
  assert.deepEqual(events, ['primeira:início']);
  assert.equal(queue.pending, 2);
  releaseFirst.resolve();
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(events, ['primeira:início', 'primeira:fim', 'segunda']);
  assert.equal(queue.pending, 0);
});

test('uma falha não bloqueia as próximas gravações nem esconde o erro original', async () => {
  const queue = createMutationQueue();
  const first = queue.run(async () => {
    throw new Error('Sem conexão');
  });
  const second = queue.run(async () => 'gravado');
  await assert.rejects(first, /Sem conexão/);
  assert.equal(await second, 'gravado');
  assert.equal(queue.pending, 0);
});

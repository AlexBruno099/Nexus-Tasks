import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isStaleDone } from '../src/shared/utils';

const now = Date.parse('2026-10-28T12:00:00Z');

test('concluída há mais de 7 dias fica recolhida', () => {
  assert.equal(isStaleDone({ completedAt: '2026-10-19T15:09:11Z' }, now), true);
});

test('concluída há 7 dias ou menos continua à vista', () => {
  assert.equal(isStaleDone({ completedAt: '2026-10-21T12:00:00Z' }, now), false);
  assert.equal(isStaleDone({ completedAt: '2026-10-27T09:00:00Z' }, now), false);
});

test('sem data de conclusão ou sem task nunca recolhe', () => {
  assert.equal(isStaleDone({ completedAt: null }, now), false);
  assert.equal(isStaleDone(undefined, now), false);
});

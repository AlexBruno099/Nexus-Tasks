import { assertRuntimeRole } from '../src/database/permissions';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type pg from 'pg';
import { buildApp } from '../src/app';
import { createIsolatedDatabase } from '../testing/database';

let database: Awaited<ReturnType<typeof createIsolatedDatabase>>;
let pool: pg.Pool;
let app: ReturnType<typeof buildApp>;

before(async () => {
  database = await createIsolatedDatabase();
  pool = database.pool;
  app = buildApp(pool);
});

after(async () => {
  await app?.close();
  await database?.close();
});

const call = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) => {
  const res = await app.inject({ method, url, payload });
  return { status: res.statusCode, body: res.body ? res.json() : undefined };
};

const board = async (archived = false) =>
  (await call('GET', `/api/board${archived ? '?archived=1' : ''}`)).body;
const labelId = async (name: string) => (await board()).labels.find((l: any) => l.name === name).id;

test('o quadro nasce com colunas e etiquetas padrão', async () => {
  const b = await board();
  assert.deepEqual(
    b.columns.map((c: any) => c.name),
    ['A fazer', 'Fazendo', 'Em teste', 'Feito'],
  );
  assert.equal(b.columns.at(-1).isDone, true);
  const names = b.labels.map((l: any) => l.name);
  for (const n of [
    'SG-PDV',
    'SG-PAY',
    'Stone',
    'Caso Marcelo',
    'SUP-DES',
    'Passou Lavou',
    'Comandas Mobile',
  ]) {
    assert.ok(names.includes(n), `faltou a etiqueta ${n}`);
  }
});

test('cria task com etiquetas e valida o título', async () => {
  const [todo] = (await board()).columns;
  const ids = [await labelId('SG-PDV'), await labelId('Stone')];
  const res = await call('POST', '/api/tasks', {
    title: '  Ajustar cupom  ',
    columnId: todo.id,
    labelIds: ids,
    dueDate: '2026-10-20',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.title, 'Ajustar cupom');
  assert.deepEqual(
    res.body.labelIds,
    [...ids].sort((a, b) => a - b),
  );
  assert.equal(res.body.dueDate, '2026-10-20');
  assert.equal(res.body.completedAt, null);

  const bad = await call('POST', '/api/tasks', { title: '   ', columnId: todo.id });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /título/);

  const ghost = await call('POST', '/api/tasks', { title: 'x', columnId: todo.id, labelIds: [99999] });
  assert.equal(ghost.status, 400);
});

test('atualiza campos sem mexer nos que não vieram', async () => {
  const [todo] = (await board()).columns;
  const { body: t } = await call('POST', '/api/tasks', {
    title: 'Checklist',
    columnId: todo.id,
    priority: 'alta',
  });
  const { status, body } = await call('PATCH', `/api/tasks/${t.id}`, {
    checklist: [{ id: 'a', text: 'Gerar APK', done: true }],
    labelIds: [await labelId('Bug')],
  });
  assert.equal(status, 200);
  assert.equal(body.priority, 'alta');
  assert.equal(body.checklist[0].text, 'Gerar APK');
  assert.equal(body.labelIds.length, 1);

  const cleared = await call('PATCH', `/api/tasks/${t.id}`, { dueDate: null, labelIds: [] });
  assert.equal(cleared.body.dueDate, null);
  assert.deepEqual(cleared.body.labelIds, []);
  assert.equal((await call('PATCH', '/api/tasks/99999', { title: 'x' })).status, 404);
});

test('move entre colunas, reordena e marca a conclusão', async () => {
  const cols = (await board()).columns;
  const doing = cols[1];
  const done = cols.find((c: any) => c.isDone);
  const mk = async (title: string) =>
    (await call('POST', '/api/tasks', { title, columnId: doing.id })).body.id;
  const a = await mk('A');
  const b = await mk('B');
  const c = await mk('C');

  await call('POST', `/api/tasks/${c}/move`, { columnId: doing.id, index: 0 });
  const order = (await board()).tasks.filter((t: any) => t.columnId === doing.id).map((t: any) => t.id);
  assert.deepEqual(order, [c, a, b]);

  const moved = await call('POST', `/api/tasks/${a}/move`, { columnId: done.id, index: 0 });
  assert.equal(moved.body.columnId, done.id);
  assert.ok(moved.body.completedAt);

  const back = await call('POST', `/api/tasks/${a}/move`, { columnId: doing.id, index: 99 });
  assert.equal(back.body.completedAt, null);
  const after = (await board()).tasks.filter((t: any) => t.columnId === doing.id).map((t: any) => t.id);
  assert.deepEqual(after, [c, b, a]);
});

test('arquivada sai do quadro e aparece no arquivo', async () => {
  const [todo] = (await board()).columns;
  const { body: t } = await call('POST', '/api/tasks', { title: 'Velha', columnId: todo.id });
  await call('PATCH', `/api/tasks/${t.id}`, { archived: true });
  assert.ok(!(await board()).tasks.some((x: any) => x.id === t.id));
  assert.ok((await board(true)).tasks.some((x: any) => x.id === t.id));
  assert.equal((await call('DELETE', `/api/tasks/${t.id}`)).status, 204);
  assert.ok(!(await board(true)).tasks.some((x: any) => x.id === t.id));
});

test('etiquetas: cria, recusa nome repetido e some das tasks ao apagar', async () => {
  const [todo] = (await board()).columns;
  const { status, body: label } = await call('POST', '/api/labels', {
    name: 'Rede',
    color: '#ff8800',
    grp: 'Maquininha',
  });
  assert.equal(status, 201);
  assert.equal((await call('POST', '/api/labels', { name: 'Rede', color: '#000000' })).status, 409);
  assert.equal((await call('POST', '/api/labels', { name: 'X', color: 'vermelho' })).status, 400);

  const { body: t } = await call('POST', '/api/tasks', {
    title: 'Com Rede',
    columnId: todo.id,
    labelIds: [label.id],
  });
  assert.equal((await call('PATCH', `/api/labels/${label.id}`, { color: '#00ff00' })).body.color, '#00ff00');
  await call('DELETE', `/api/labels/${label.id}`);
  const after = (await board()).tasks.find((x: any) => x.id === t.id);
  assert.deepEqual(after.labelIds, []);
});

test('branches: trancada não recebe nem solta task e só aceita destrancar', async () => {
  const [todo] = (await board()).columns;
  const { body: br } = await call('POST', '/api/branches', { repo: 'sg-pdv-all', name: 'fix/trancada' });
  const { body: other } = await call('POST', '/api/branches', { repo: 'sg-pdv-all', name: 'fix/aberta' });
  const { body: inside } = await call('POST', '/api/tasks', {
    title: 'Já estava',
    columnId: todo.id,
    branchId: br.id,
  });
  const { body: loose } = await call('POST', '/api/tasks', { title: 'Solta', columnId: todo.id });

  const { body: locked } = await call('PATCH', `/api/branches/${br.id}`, { locked: true, merged: true });
  assert.equal(locked.locked, true);
  assert.equal(locked.merged, true);
  assert.equal(other.locked, false);

  assert.equal(
    (await call('POST', '/api/tasks', { title: 'Nova', columnId: todo.id, branchId: br.id })).status,
    409,
  );
  assert.equal((await call('PATCH', `/api/tasks/${loose.id}`, { branchId: br.id })).status, 409);
  assert.equal((await call('PATCH', `/api/tasks/${inside.id}`, { branchId: other.id })).status, 409);
  assert.equal((await call('PATCH', `/api/tasks/${inside.id}`, { branchId: null })).status, 409);
  assert.equal((await call('PATCH', `/api/tasks/${inside.id}`, { title: 'Renomeada' })).status, 200);
  assert.equal((await call('PATCH', `/api/branches/${br.id}`, { notes: 'x' })).status, 409);

  assert.equal((await call('PATCH', `/api/branches/${br.id}`, { locked: false })).body.locked, false);
  assert.equal((await call('PATCH', `/api/tasks/${loose.id}`, { branchId: br.id })).status, 200);
});

test('branches: cria, liga task, recusa repetida e solta as tasks ao apagar', async () => {
  const [todo] = (await board()).columns;
  const { status, body: br } = await call('POST', '/api/branches', {
    repo: ' sg-pdv-all ',
    name: 'fix/clickup',
  });
  assert.equal(status, 201);
  assert.equal(br.repo, 'sg-pdv-all');
  assert.equal(br.merged, false);
  assert.equal(
    (await call('POST', '/api/branches', { repo: 'sg-pdv-all', name: 'fix/clickup' })).status,
    409,
  );
  assert.equal((await call('POST', '/api/branches', { repo: 'sg-pay', name: 'fix/clickup' })).status, 201);
  assert.equal((await call('POST', '/api/branches', { repo: 'sg-pay', name: '  ' })).status, 400);

  const { body: t } = await call('POST', '/api/tasks', {
    title: 'Na branch',
    columnId: todo.id,
    branchId: br.id,
  });
  assert.equal(t.branchId, br.id);
  assert.equal(
    (await call('POST', '/api/tasks', { title: 'x', columnId: todo.id, branchId: 99999 })).status,
    400,
  );
  assert.equal((await call('PATCH', `/api/branches/${br.id}`, { merged: true })).body.merged, true);
  assert.ok((await board()).branches.some((b: any) => b.id === br.id && b.merged));
  assert.equal(br.color, '#8B5CF6');
  assert.equal(br.notes, '');
  const { body: custom } = await call('PATCH', `/api/branches/${br.id}`, {
    color: '#22C55E',
    notes: 'PR #123',
  });
  assert.equal(custom.color, '#22C55E');
  assert.equal(custom.notes, 'PR #123');
  assert.equal(custom.merged, true);
  assert.equal((await call('PATCH', `/api/branches/${br.id}`, { color: 'verde' })).status, 400);

  const { body: loose } = await call('PATCH', `/api/tasks/${t.id}`, { branchId: null });
  assert.equal(loose.branchId, null);
  await call('PATCH', `/api/tasks/${t.id}`, { branchId: br.id });
  assert.equal((await call('DELETE', `/api/branches/${br.id}`)).status, 204);
  const after = (await board()).tasks.find((x: any) => x.id === t.id);
  assert.equal(after.branchId, null);
});

test('colunas: cria, renomeia e só apaga vazia', async () => {
  const { body: col } = await call('POST', '/api/columns', { name: 'Bloqueado' });
  assert.equal((await call('PATCH', `/api/columns/${col.id}`, { name: 'Travado' })).body.name, 'Travado');
  const { body: t } = await call('POST', '/api/tasks', { title: 'Presa', columnId: col.id });
  assert.equal((await call('DELETE', `/api/columns/${col.id}`)).status, 409);
  await call('DELETE', `/api/tasks/${t.id}`);
  assert.equal((await call('DELETE', `/api/columns/${col.id}`)).status, 204);
});

test('branch trancada protege exclusões diretas, incluindo tarefas arquivadas', async () => {
  const [todo] = (await board()).columns;
  const { body: branch } = await call('POST', '/api/branches', { repo: 'regression', name: 'locked-delete' });
  const { body: task } = await call('POST', '/api/tasks', {
    title: 'Protegida',
    columnId: todo.id,
    branchId: branch.id,
  });
  await call('PATCH', `/api/tasks/${task.id}`, { archived: true });
  await call('PATCH', `/api/branches/${branch.id}`, { locked: true });
  assert.equal((await call('DELETE', `/api/tasks/${task.id}`)).status, 409);
  assert.equal((await call('DELETE', `/api/branches/${branch.id}`)).status, 409);
  assert.equal((await board(true)).tasks.find((item: any) => item.id === task.id).branchId, branch.id);
  await call('PATCH', `/api/branches/${branch.id}`, { locked: false });
  assert.equal((await call('DELETE', `/api/tasks/${task.id}`)).status, 204);
  assert.equal((await call('DELETE', `/api/branches/${branch.id}`)).status, 204);
});

test('datas reais e IDs int32 são validados antes do acesso ao banco', async () => {
  const [todo] = (await board()).columns;
  for (const dueDate of ['2026-02-31', '2025-02-29', '2026-13-01', '0000-01-01']) {
    assert.equal(
      (await call('POST', '/api/tasks', { title: 'Data inválida', columnId: todo.id, dueDate })).status,
      400,
    );
  }
  const leap = await call('POST', '/api/tasks', {
    title: 'Bissexto',
    columnId: todo.id,
    dueDate: '2028-02-29',
  });
  assert.equal(leap.status, 201);
  assert.equal(leap.body.dueDate, '2028-02-29');
  assert.equal((await call('PATCH', `/api/tasks/${leap.body.id}`, { dueDate: '2026-02-30' })).status, 400);
  for (const entity of ['tasks', 'branches', 'labels', 'columns']) {
    assert.equal((await call('PATCH', `/api/${entity}/2147483648`, {})).status, 400);
    assert.equal((await call('DELETE', `/api/${entity}/9007199254740992`)).status, 400);
  }
  assert.equal(
    (await call('POST', '/api/tasks', { title: 'ID inválido', columnId: 2147483648 })).status,
    400,
  );
});

test('mudar isDone sincroniza conclusão de tarefas ativas e arquivadas', async () => {
  const { body: column } = await call('POST', '/api/columns', { name: 'Sincronização' });
  const { body: active } = await call('POST', '/api/tasks', { title: 'Ativa', columnId: column.id });
  const { body: archived } = await call('POST', '/api/tasks', { title: 'Arquivada', columnId: column.id });
  await call('PATCH', `/api/tasks/${archived.id}`, { archived: true });
  assert.equal((await call('PATCH', `/api/columns/${column.id}`, { isDone: true })).status, 200);
  const completed = (await board()).tasks.find((task: any) => task.id === active.id).completedAt;
  assert.ok(completed);
  assert.ok((await board(true)).tasks.find((task: any) => task.id === archived.id).completedAt);
  await call('PATCH', `/api/columns/${column.id}`, { isDone: true });
  assert.equal((await board()).tasks.find((task: any) => task.id === active.id).completedAt, completed);
  await call('PATCH', `/api/columns/${column.id}`, { isDone: false });
  assert.equal((await board()).tasks.find((task: any) => task.id === active.id).completedAt, null);
  assert.equal((await board(true)).tasks.find((task: any) => task.id === archived.id).completedAt, null);
});

test('conta da API permite CRUD, mas não DDL nem alteração do histórico de migrações', async () => {
  await assert.rejects(assertRuntimeRole(database.migrationPool), /conta administrativa/);
  await assert.rejects(pool.query('create table forbidden (id int)'), { code: '42501' });
  await assert.rejects(pool.query('delete from schema_migrations'), { code: '42501' });
  const role = (
    await pool.query('select rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname = current_user')
  ).rows[0];
  assert.deepEqual(role, { rolsuper: false, rolcreatedb: false, rolcreaterole: false });
});

test('respostas têm cabeçalhos de segurança e erros HTTP previsíveis', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.match(String(response.headers['content-security-policy']), /frame-ancestors 'none'/);
  assert.equal((await call('GET', '/api/does-not-exist')).status, 404);
  const malformed = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { 'content-type': 'application/json' },
    payload: '{"title":',
  });
  assert.equal(malformed.statusCode, 400);
  assert.equal(typeof malformed.json().error, 'string');
});

const http = require('node:http');
// Mock com estado alinhado ao contrato validado pelas coleções real e simulada.
// BEGIN SEED (gerado por npm run postman:generate)
const seedColumns = [
  ['A fazer', false],
  ['Fazendo', false],
  ['Em teste', false],
  ['Feito', true],
];
const seedLabels = [
  ['Produto', 'SG-PDV', '#3B6CF6'],
  ['Produto', 'SG-PAY', '#7C4DFF'],
  ['Produto', 'Site das maquininhas', '#0EA5A4'],
  ['Produto', 'Passou Lavou', '#06B6D4'],
  ['Produto', 'Comandas Mobile', '#F97316'],
  ['Produto', 'POS Manager', '#6366F1'],
  ['Produto', 'POS Compatibility', '#8B5CF6'],
  ['Produto', 'SG Life', '#EC4899'],
  ['Produto', 'SG Presença Digital', '#14B8A6'],
  ['Produto', 'Meu Financeiro', '#84CC16'],
  ['Maquininha', 'Mercado Pago', '#00A6E0'],
  ['Maquininha', 'Stone', '#00A868'],
  ['Maquininha', 'Getnet', '#E3000F'],
  ['Maquininha', 'Cielo', '#0079C1'],
  ['Maquininha', 'Sicoob', '#00796B'],
  ['Maquininha', 'Clover', '#1C8C3C'],
  ['Maquininha', 'PagBank', '#D4A500'],
  ['Maquininha', 'Vero', '#0057B8'],
  ['Maquininha', 'BIN', '#F26722'],
  ['Demanda', 'Ajustes', '#F59E0B'],
  ['Demanda', 'Implementação', '#2563EB'],
  ['Demanda', 'SUP-DES', '#DC2626'],
  ['Demanda', 'Caso Marcelo', '#9333EA'],
  ['Tipo', 'Bug', '#EF4444'],
  ['Tipo', 'Feature', '#22C55E'],
  ['Tipo', 'Urgente', '#B91C1C'],
  ['Tipo', 'Reunião', '#64748B'],
  ['Tipo', 'Deploy', '#0891B2'],
];
// END SEED
function initialState() {
  return {
    columns: seedColumns.map(([name, isDone], i) => ({ id: i + 1, name, isDone, position: i })),
    labels: seedLabels.map(([grp, name, color], i) => ({ id: i + 1, name, color, grp, position: i })),
    tasks: [],
    branches: [],
    next: { columns: seedColumns.length + 1, labels: seedLabels.length + 1, tasks: 1, branches: 1 },
  };
}
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
const invalid = (field) => fail(400, `${field}: valor inválido`);
function id(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 2147483647) invalid(field);
  return n;
}
function text(value, field, min, max, trim = true) {
  if (typeof value !== 'string') invalid(field);
  const out = trim ? value.trim() : value;
  if (out.length < min || out.length > max) invalid(field);
  return out;
}
function flag(value, field) {
  if (typeof value !== 'boolean') invalid(field);
  return value;
}
function hex(value) {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) invalid('color');
  return value;
}
function parseBody(entity, input, create) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('corpo');
  const out = {};
  const take = (field, fn) => {
    if (input[field] !== undefined) out[field] = fn(input[field]);
  };
  if (entity === 'tasks') {
    take('title', (v) => text(v, 'title', 1, 200));
    take('description', (v) => text(v, 'description', 0, 20000, false));
    take('priority', (v) => {
      if (!['baixa', 'media', 'alta', 'urgente'].includes(v)) invalid('priority');
      return v;
    });
    take('dueDate', (v) => {
      if (v !== null) {
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v.startsWith('0000'))
          invalid('dueDate');
        const date = new Date(v + 'T00:00:00Z');
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== v) invalid('dueDate');
      }
      return v;
    });
    take('labelIds', (v) => {
      if (!Array.isArray(v) || v.length > 50) invalid('labelIds');
      return [...new Set(v.map((x) => id(x, 'labelIds')))];
    });
    take('branchId', (v) => (v === null ? null : id(v, 'branchId')));
    take('checklist', (v) => {
      if (!Array.isArray(v) || v.length > 200) invalid('checklist');
      return v.map((item) => ({
        id: text(item?.id, 'checklist.id', 1, 64, false),
        text: text(item?.text, 'checklist.text', 1, 300),
        done: flag(item?.done, 'checklist.done'),
      }));
    });
    if (create) {
      out.columnId = id(input.columnId, 'columnId');
      if (out.title === undefined) invalid('title');
      return {
        description: '',
        priority: 'media',
        dueDate: null,
        labelIds: [],
        branchId: null,
        checklist: [],
        ...out,
      };
    }
    take('archived', (v) => flag(v, 'archived'));
  } else if (entity === 'labels') {
    take('name', (v) => text(v, 'name', 1, 40));
    take('color', hex);
    take('grp', (v) => text(v, 'grp', 1, 30));
    if (create) {
      if (!out.name || !out.color) invalid('name/color');
      out.grp ??= 'Geral';
    }
  } else if (entity === 'columns') {
    take('name', (v) => text(v, 'name', 1, 40));
    if (create && !out.name) invalid('name');
    if (!create) take('isDone', (v) => flag(v, 'isDone'));
  } else if (entity === 'branches') {
    take('repo', (v) => text(v, 'repo', 1, 60));
    take('name', (v) => text(v, 'name', 1, 120));
    if (create && (!out.repo || !out.name)) invalid('repo/name');
    if (!create) {
      take('color', hex);
      take('notes', (v) => text(v, 'notes', 0, 4000, false));
      take('merged', (v) => flag(v, 'merged'));
      take('locked', (v) => flag(v, 'locked'));
    }
  }
  return out;
}
function unlocked(state, branchId) {
  const b = state.branches.find((b) => b.id === branchId);
  if (b?.locked) fail(409, `A branch ${b.name} está trancada. Destranque para mexer nas tasks dela.`);
}
function foreignKeys(state, body) {
  if (body.columnId !== undefined && !state.columns.some((c) => c.id === body.columnId))
    fail(400, 'Coluna, etiqueta ou branch inexistente.');
  if (body.branchId != null && !state.branches.some((b) => b.id === body.branchId))
    fail(400, 'Coluna, etiqueta ou branch inexistente.');
  if (body.labelIds?.some((id) => !state.labels.some((l) => l.id === id)))
    fail(400, 'Coluna, etiqueta ou branch inexistente.');
  if (body.dueDate) {
    const d = new Date(body.dueDate + 'T00:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== body.dueDate) invalid('dueDate');
  }
}
function unique(state, entity, body, ownId) {
  if (entity === 'labels' && state.labels.some((x) => x.id !== ownId && x.name === body.name))
    fail(409, 'Já existe um item com esse nome.');
  if (
    entity === 'branches' &&
    state.branches.some((x) => x.id !== ownId && x.repo === body.repo && x.name === body.name)
  )
    fail(409, 'Já existe um item com esse nome.');
}
function sync(state, task) {
  task.completedAt = state.columns.find((c) => c.id === task.columnId)?.isDone
    ? (task.completedAt ?? new Date().toISOString())
    : null;
}
// @endpoint GET /api/health
// @endpoint GET /api/board
// @endpoint POST /api/tasks
// @endpoint PATCH /api/tasks/:id
// @endpoint POST /api/tasks/:id/move
// @endpoint DELETE /api/tasks/:id
// @endpoint POST /api/labels
// @endpoint PATCH /api/labels/:id
// @endpoint DELETE /api/labels/:id
// @endpoint POST /api/columns
// @endpoint PATCH /api/columns/:id
// @endpoint DELETE /api/columns/:id
// @endpoint POST /api/branches
// @endpoint PATCH /api/branches/:id
// @endpoint DELETE /api/branches/:id
// @endpoint POST /api/__mock/reset
http
  .createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    try {
      // Cópia por requisição: uma validação que falha não altera o estado salvo.
      const state = JSON.parse(JSON.stringify((await pm.state.get('bobina')) ?? initialState()));
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname.replace(/^\/api(?=\/|$)/, '');
      const method = req.method;
      if (path === '/__mock/reset' && method === 'POST') {
        await pm.state.set('bobina', initialState());
        return send(200, { ok: true });
      }
      if (path === '/health' && method === 'GET') return send(200, { ok: true });
      if (path === '/board' && method === 'GET') {
        const archived = url.searchParams.get('archived') === '1';
        return send(200, {
          columns: state.columns.sort((a, b) => a.position - b.position || a.id - b.id),
          labels: state.labels.sort((a, b) => a.position - b.position || a.id - b.id),
          branches: state.branches.sort(
            (a, b) => a.repo.localeCompare(b.repo) || a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
          ),
          tasks: state.tasks
            .filter((t) => t.archived === archived)
            .sort((a, b) => a.columnId - b.columnId || a.position - b.position || a.id - b.id),
        });
      }
      const match = path.match(/^\/(tasks|labels|columns|branches)(?:\/([^/]+))?(\/move)?$/);
      if (!match) fail(404, 'Rota não encontrada.');
      const [, entity, rawId, move] = match;
      const itemId = rawId === undefined ? undefined : id(rawId);
      const list = state[entity];
      const item = list.find((x) => x.id === itemId);
      const missing =
        { tasks: 'Task', columns: 'Coluna', labels: 'Etiqueta', branches: 'Branch' }[entity] +
        ' não encontrada.';
      let result,
        status = 200;
      if (method === 'POST' && !rawId) {
        const body = parseBody(entity, req.body, true);
        if (entity === 'tasks') {
          unlocked(state, body.branchId);
          foreignKeys(state, body);
        }
        unique(state, entity, body);
        const now = new Date().toISOString();
        result = { id: state.next[entity]++, ...body };
        if (entity === 'tasks') {
          Object.assign(result, {
            position:
              Math.max(-1, ...list.filter((t) => t.columnId === body.columnId).map((t) => t.position)) + 1,
            archived: false,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
          });
          result.labelIds.sort((a, b) => a - b);
          sync(state, result);
        } else if (entity === 'branches')
          Object.assign(result, {
            merged: false,
            locked: false,
            color: '#8B5CF6',
            notes: '',
            createdAt: now,
          });
        else
          Object.assign(result, {
            position: Math.max(-1, ...list.map((x) => x.position)) + 1,
            ...(entity === 'columns' ? { isDone: false } : {}),
          });
        list.push(result);
        status = 201;
      } else if (method === 'POST' && move && entity === 'tasks') {
        const body = req.body;
        if (!body || typeof body !== 'object') invalid('corpo');
        const columnId = id(body.columnId, 'columnId');
        if (!Number.isInteger(body.index) || body.index < 0) invalid('index');
        if (!item) fail(404, missing);
        foreignKeys(state, { columnId });
        const ordered = list
          .filter((t) => t.columnId === columnId && t.id !== item.id && !t.archived)
          .sort((a, b) => a.position - b.position || a.id - b.id);
        ordered.splice(Math.min(body.index, ordered.length), 0, item);
        ordered.forEach((t, i) => {
          t.columnId = columnId;
          t.position = i;
        });
        item.updatedAt = new Date().toISOString();
        sync(state, item);
        result = item;
      } else if (method === 'PATCH' && rawId && !move) {
        const body = parseBody(entity, req.body, false);
        if (entity === 'tasks') {
          if (body.branchId !== undefined && item && item.branchId !== body.branchId) {
            unlocked(state, item.branchId);
            unlocked(state, body.branchId);
          }
          foreignKeys(state, body);
        }
        if (!item) fail(404, missing);
        if (
          entity === 'branches' &&
          item.locked &&
          body.locked !== false &&
          Object.keys(body).some((k) => k !== 'locked' && k !== 'merged')
        )
          fail(409, 'Branch trancada. Destranque para editar.');
        unique(state, entity, { ...item, ...body }, itemId);
        Object.assign(item, body);
        if (entity === 'tasks') {
          item.labelIds.sort((a, b) => a - b);
          item.updatedAt = new Date().toISOString();
        }
        if (entity === 'columns' && body.isDone !== undefined)
          state.tasks
            .filter((task) => task.columnId === itemId)
            .forEach((task) => {
              sync(state, task);
              task.updatedAt = new Date().toISOString();
            });
        result = item;
      } else if (method === 'DELETE' && rawId && !move) {
        if (entity === 'columns' && state.tasks.some((t) => t.columnId === itemId))
          fail(409, 'A coluna tem task(s), contando as arquivadas. Mova ou apague antes.');
        if (!item) fail(404, missing);
        if (entity === 'branches' && item.locked) fail(409, 'Branch trancada. Destranque para excluir.');
        if (entity === 'tasks') unlocked(state, item.branchId);
        state[entity] = list.filter((x) => x.id !== itemId);
        if (entity === 'labels')
          state.tasks.forEach((t) => (t.labelIds = t.labelIds.filter((id) => id !== itemId)));
        // Excluir uma branch aberta mantém suas tarefas sem vínculo.
        if (entity === 'branches')
          state.tasks.forEach((t) => {
            if (t.branchId === itemId) t.branchId = null;
          });
        status = 204;
      } else fail(404, 'Rota não encontrada.');
      await pm.state.set('bobina', state);
      send(status, result);
    } catch (err) {
      send(err.status ?? 500, { error: err.status ? err.message : 'Erro interno do servidor.' });
    }
  })
  .listen(process.env.PORT, '127.0.0.1');

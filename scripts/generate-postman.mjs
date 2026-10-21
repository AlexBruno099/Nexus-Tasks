import { format, resolveConfig } from 'prettier';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SEED_COLUMNS, SEED_LABELS } from '../server/src/database/seeds.ts';

// Fonte das duas representações: YAML v3 para CLI e JSON v2.1 para importar.
const root = fileURLToPath(new URL('../postman/', import.meta.url));
const collections = [];
let current;
function collection(slug, name, description) {
  current = { slug, name, description, requests: [] };
  collections.push(current);
}
function request(name, method, path, body, status, checks = '', options = {}) {
  const statuses = Array.isArray(status) ? status : [status];
  const test =
    `pm.test('Status HTTP esperado: ${statuses.join(' ou ')}', () => pm.expect(pm.response.code).to.be.oneOf(${JSON.stringify(statuses)}));\n` +
    (statuses.every((s) => s === 204)
      ? "pm.test('Resposta sem corpo', () => pm.expect(pm.response.text()).to.eql(''));\n"
      : '') +
    checks;
  current.requests.push({ name, method, path, body, status, test, ...options });
}
const get = (name, check, path = '/board') => request(name, 'GET', path, undefined, 200, check);
const save = (key) =>
  `if (pm.response.code === 201) pm.collectionVariables.set('${key}', pm.response.json().id);`;
const eq = (label, expression, expected) =>
  `pm.test(${JSON.stringify(label)}, () => pm.expect(${expression}).to.eql(${expected}));\n`;
const json = 'pm.response.json()';
const cv = (key) => `Number(pm.collectionVariables.get('${key}'))`;
const taskFromBoard = (key) => `${json}.tasks.find(t => t.id === ${cv(key)})`;
const taskSchema = {
  type: 'object',
  required: [
    'id',
    'title',
    'description',
    'columnId',
    'position',
    'priority',
    'dueDate',
    'checklist',
    'archived',
    'createdAt',
    'updatedAt',
    'completedAt',
    'labelIds',
    'branchId',
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'integer', minimum: 1 },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string' },
    columnId: { type: 'integer' },
    position: { type: 'integer' },
    priority: { enum: ['baixa', 'media', 'alta', 'urgente'] },
    dueDate: { type: ['string', 'null'] },
    checklist: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'text', 'done'],
        properties: { id: { type: 'string' }, text: { type: 'string' }, done: { type: 'boolean' } },
      },
    },
    archived: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    completedAt: { type: ['string', 'null'], format: 'date-time' },
    labelIds: { type: 'array', items: { type: 'integer' }, uniqueItems: true },
    branchId: { type: ['integer', 'null'] },
  },
};
const schemaCheck = `pm.test('Contrato da tarefa', () => pm.response.to.have.jsonSchema(${JSON.stringify(taskSchema)}));\n`;
const init =
  "pm.collectionVariables.set('runId', Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));\n" +
  "['todoId','doneId','labelId','branchId','taskId','secondId','lockedTaskId','lockedBranchId','goneTaskId','goneBranchId','completionTaskId'].forEach(k => pm.collectionVariables.unset(k));";
function setup() {
  request('Saúde da API', 'GET', '/health', undefined, 200, eq('Banco respondeu', `${json}.ok`, 'true'), {
    before: init,
    example: { ok: true },
  });
  get(
    'Ler quadro e conferir contrato',
    `pm.test('Quadro contém as quatro listas', () => pm.expect(${json}).to.have.all.keys('columns','labels','branches','tasks'));\n` +
      `pm.test('Listas e contratos', () => { const b=${json}; ['columns','labels','branches','tasks'].forEach(k=>pm.expect(b[k]).to.be.an('array')); b.tasks.forEach(t=>pm.expect(t).to.have.jsonSchema(${JSON.stringify(taskSchema)})); });`,
  );
  request(
    'Criar coluna de entrada',
    'POST',
    '/columns',
    { name: 'Postman {{runId}}' },
    201,
    save('todoId') + eq('Coluna começa aberta', `${json}.isDone`, 'false'),
  );
  request(
    'Criar coluna de conclusão',
    'POST',
    '/columns',
    { name: 'Concluído {{runId}}' },
    201,
    save('doneId'),
  );
  request(
    'Configurar coluna como concluída',
    'PATCH',
    '/columns/{{doneId}}',
    { isDone: true, name: 'Feito {{runId}}' },
    200,
    eq('Coluna de conclusão', `${json}.isDone`, 'true'),
  );
  request(
    'Criar etiqueta',
    'POST',
    '/labels',
    { name: 'PM {{runId}}', color: '#8B5CF6', grp: 'Postman' },
    201,
    save('labelId') + eq('Grupo da etiqueta', `${json}.grp`, "'Postman'"),
  );
  request(
    'Criar branch',
    'POST',
    '/branches',
    { repo: 'postman', name: 'test/{{runId}}' },
    201,
    save('branchId') + eq('Branch começa destrancada', `${json}.locked`, 'false'),
  );
}
collection(
  'bobina-api',
  'nexus-tasks — API completa',
  'Execute a coleção inteira na ordem. Cria e remove apenas os próprios registros. Use o ambiente Sandbox (npm run api:sandbox) ou Mock. Todas as 15 operações da API são exercitadas. Sem autenticação no uso local.',
);
setup();
request(
  'Atualizar etiqueta',
  'PATCH',
  '/labels/{{labelId}}',
  { name: 'PM {{runId}}', color: '#22C55E', grp: 'Verificação' },
  200,
  eq('Cor atualizada', `${json}.color`, "'#22C55E'"),
);
request(
  'Atualizar branch',
  'PATCH',
  '/branches/{{branchId}}',
  { color: '#22C55E', notes: 'Criada pelo Postman', merged: true },
  200,
  eq('Anotação persistida', `${json}.notes`, "'Criada pelo Postman'"),
);
request(
  'Criar tarefa completa',
  'POST',
  '/tasks',
  {
    title: '  Tarefa {{runId}}  ',
    columnId: '{{todoId}}',
    description: 'Contexto de teste',
    priority: 'alta',
    dueDate: '2026-10-20',
    labelIds: ['{{labelId}}', '{{labelId}}'],
    branchId: '{{branchId}}',
    checklist: [{ id: 'item-1', text: 'Verificar API', done: false }],
  },
  201,
  save('taskId') +
    schemaCheck +
    eq('Etiquetas sem duplicação', `${json}.labelIds`, `[${cv('labelId')}]`) +
    eq('Título normalizado', `${json}.title`, `'Tarefa '+pm.collectionVariables.get('runId')`),
);
request(
  'Criar tarefa com valores padrão',
  'POST',
  '/tasks',
  { title: 'Segunda {{runId}}', columnId: '{{todoId}}' },
  201,
  save('secondId') + schemaCheck + eq('Prioridade padrão', `${json}.priority`, "'media'"),
);
get(
  'Conferir persistência da criação',
  eq('Tarefa presente', `${taskFromBoard('taskId')}.description`, "'Contexto de teste'"),
);
request(
  'Atualizar checklist sem perder prioridade',
  'PATCH',
  '/tasks/{{taskId}}',
  { checklist: [{ id: 'item-1', text: 'Verificar API', done: true }] },
  200,
  schemaCheck +
    eq('Prioridade preservada', `${json}.priority`, "'alta'") +
    eq('Checklist marcado', `${json}.checklist[0].done`, 'true'),
);
request(
  'Mover e concluir tarefa',
  'POST',
  '/tasks/{{taskId}}/move',
  { columnId: '{{doneId}}', index: 0 },
  200,
  schemaCheck +
    `pm.test('Data de conclusão preenchida',()=>pm.expect(${json}.completedAt).to.be.a('string'));`,
);
request(
  'Reabrir e reordenar tarefa',
  'POST',
  '/tasks/{{taskId}}/move',
  { columnId: '{{todoId}}', index: 0 },
  200,
  eq('Conclusão removida', `${json}.completedAt`, 'null'),
);
get(
  'Conferir ordem das tarefas',
  eq(
    'Tarefa movida é a primeira',
    `${json}.tasks.filter(t=>t.columnId===${cv('todoId')})[0].id`,
    cv('taskId'),
  ),
);
request(
  'Arquivar tarefa',
  'PATCH',
  '/tasks/{{taskId}}',
  { archived: true },
  200,
  eq('Arquivada', `${json}.archived`, 'true'),
);
get(
  'Arquivada sai do quadro',
  eq('Ausente no quadro', `${json}.tasks.some(t=>t.id===${cv('taskId')})`, 'false'),
);
get(
  'Arquivada aparece no arquivo',
  eq('Presente no arquivo', `${taskFromBoard('taskId')}.archived`, 'true'),
  '/board?archived=1',
);
request(
  'Restaurar e limpar prazo',
  'PATCH',
  '/tasks/{{taskId}}',
  { archived: false, dueDate: null },
  200,
  eq('Restaurada', `${json}.archived`, 'false') + eq('Prazo removido', `${json}.dueDate`, 'null'),
);
const invalids = [
  ['Recusar título vazio', 'POST', '/tasks', { title: ' ', columnId: '{{todoId}}' }, 400],
  ['Recusar prioridade desconhecida', 'PATCH', '/tasks/{{taskId}}', { priority: 'inexistente' }, 400],
  ['Recusar data fora do formato', 'PATCH', '/tasks/{{taskId}}', { dueDate: '20/10/2026' }, 400],
  ['Recusar coluna inexistente', 'POST', '/tasks', { title: 'Inexistente', columnId: 2147483647 }, 400],
  [
    'Recusar etiqueta inexistente',
    'POST',
    '/tasks',
    { title: 'Rollback {{runId}}', columnId: '{{todoId}}', labelIds: [2147483647] },
    400,
  ],
  [
    'Recusar branch inexistente',
    'POST',
    '/tasks',
    { title: 'Branch inválida', columnId: '{{todoId}}', branchId: 2147483647 },
    400,
  ],
  ['Recusar identificador inválido', 'PATCH', '/tasks/abc', { title: 'Inválida' }, 400],
  ['Recusar índice negativo', 'POST', '/tasks/{{taskId}}/move', { columnId: '{{todoId}}', index: -1 }, 400],
  ['Recusar cor inválida', 'PATCH', '/labels/{{labelId}}', { color: 'verde' }, 400],
  ['Recusar etiqueta repetida', 'POST', '/labels', { name: 'PM {{runId}}', color: '#000000' }, 409],
  ['Recusar branch repetida', 'POST', '/branches', { repo: 'postman', name: 'test/{{runId}}' }, 409],
];
invalids.forEach(([name, method, path, body, status]) => request(name, method, path, body, status));
get(
  'Rollback não deixa tarefa parcial',
  eq(
    'Criação inválida não persistiu',
    `${json}.tasks.some(t=>t.title==='Rollback '+pm.collectionVariables.get('runId'))`,
    'false',
  ),
);
request(
  'Trancar branch',
  'PATCH',
  '/branches/{{branchId}}',
  { locked: true },
  200,
  eq('Trancada', `${json}.locked`, 'true'),
);
request(
  'Recusar nova tarefa em branch trancada',
  'POST',
  '/tasks',
  { title: 'Trancada', columnId: '{{todoId}}', branchId: '{{branchId}}' },
  409,
);
request(
  'Recusar entrada em branch trancada',
  'PATCH',
  '/tasks/{{secondId}}',
  { branchId: '{{branchId}}' },
  409,
);
request('Recusar saída de branch trancada', 'PATCH', '/tasks/{{taskId}}', { branchId: null }, 409);
request(
  'Recusar edição de branch trancada',
  'PATCH',
  '/branches/{{branchId}}',
  { notes: 'Não deve gravar' },
  409,
);
request(
  'Destrancar branch',
  'PATCH',
  '/branches/{{branchId}}',
  { locked: false },
  200,
  eq('Destrancada', `${json}.locked`, 'false'),
);
request(
  'Remover vínculo com branch',
  'PATCH',
  '/tasks/{{taskId}}',
  { branchId: null },
  200,
  eq('Sem branch', `${json}.branchId`, 'null'),
);
request(
  'Restaurar vínculo com branch',
  'PATCH',
  '/tasks/{{taskId}}',
  { branchId: '{{branchId}}' },
  200,
  eq('Branch restaurada', `${json}.branchId`, cv('branchId')),
);
request('Excluir etiqueta', 'DELETE', '/labels/{{labelId}}', undefined, 204);
get(
  'Exclusão da etiqueta limpa vínculos',
  eq('Tarefa sem etiquetas', `${taskFromBoard('taskId')}.labelIds`, '[]'),
);
request('Excluir branch aberta', 'DELETE', '/branches/{{branchId}}', undefined, 204);
get(
  'Exclusão da branch preserva tarefa',
  eq('Tarefa preservada sem branch', `${taskFromBoard('taskId')}.branchId`, 'null'),
);
request('Recusar exclusão de coluna ocupada', 'DELETE', '/columns/{{todoId}}', undefined, 409);
for (const entity of ['tasks', 'labels', 'branches', 'columns']) {
  request(`Atualizar ${entity} inexistente`, 'PATCH', `/${entity}/2147483647`, {}, 404);
  request(`Excluir ${entity} inexistente`, 'DELETE', `/${entity}/2147483647`, undefined, 404);
}
request('Excluir primeira tarefa', 'DELETE', '/tasks/{{taskId}}', undefined, 204);
request('Excluir segunda tarefa', 'DELETE', '/tasks/{{secondId}}', undefined, 204);
request('Excluir coluna de entrada', 'DELETE', '/columns/{{todoId}}', undefined, 204);
request('Excluir coluna de conclusão', 'DELETE', '/columns/{{doneId}}', undefined, 204);
get(
  'Conferir limpeza dos registros',
  `pm.test('Registros deste teste foram removidos',()=>{ const b=${json}; pm.expect(b.tasks.some(t=>[${cv('taskId')},${cv('secondId')}].includes(t.id))).to.eql(false); pm.expect(b.columns.some(c=>[${cv('todoId')},${cv('doneId')}].includes(c.id))).to.eql(false); pm.expect(b.branches.some(b=>b.id===${cv('branchId')})).to.eql(false); pm.expect(b.labels.some(l=>l.id===${cv('labelId')})).to.eql(false); });`,
);

collection(
  'bobina-regressoes',
  'nexus-tasks — regressões de segurança e consistência',
  'Asserções obrigatórias: calendário real, faixa dos IDs, bloqueio de exclusões e sincronização da conclusão. Executar em banco isolado ou mock; ambos devem passar.',
);
setup();
request(
  'Criar tarefa de conclusão',
  'POST',
  '/tasks',
  { title: 'Conclusão {{runId}}', columnId: '{{todoId}}' },
  201,
  save('completionTaskId'),
);
request('Marcar coluna ocupada como concluída', 'PATCH', '/columns/{{todoId}}', { isDone: true }, 200);
get(
  'Regressão — sincronizar data de conclusão',
  `pm.test('Tarefa da coluna concluída tem completedAt',()=>pm.expect(${taskFromBoard('completionTaskId')}.completedAt).to.be.a('string'));`,
);
request(
  'Regressão — recusar data impossível com 400',
  'POST',
  '/tasks',
  { title: 'Data impossível', columnId: '{{todoId}}', dueDate: '2026-02-31' },
  400,
);
request(
  'Regressão — recusar ID fora da faixa com 400',
  'PATCH',
  '/tasks/2147483648',
  { title: 'ID inválido' },
  400,
);

request(
  'Recusar data impossível em atualização',
  'PATCH',
  '/tasks/{{completionTaskId}}',
  { dueDate: '2025-02-29' },
  400,
);
request(
  'Aceitar ano bissexto',
  'PATCH',
  '/tasks/{{completionTaskId}}',
  { dueDate: '2028-02-29' },
  200,
  eq('Prazo bissexto preservado', `${json}.dueDate`, "'2028-02-29'"),
);
request('Reabrir coluna com tarefas', 'PATCH', '/columns/{{todoId}}', { isDone: false }, 200);
get(
  'Conclusão removida ao reabrir coluna',
  eq('completedAt volta a null', `${taskFromBoard('completionTaskId')}.completedAt`, 'null'),
);

request(
  'Criar tarefa em branch para exclusão',
  'POST',
  '/tasks',
  { title: 'Protegida {{runId}}', columnId: '{{todoId}}', branchId: '{{branchId}}' },
  201,
  save('lockedTaskId'),
);
request('Trancar branch para exclusão', 'PATCH', '/branches/{{branchId}}', { locked: true }, 200);
request(
  'Regressão — impedir exclusão de tarefa trancada',
  'DELETE',
  '/tasks/{{lockedTaskId}}',
  undefined,
  409,
);
request(
  'Regressão — impedir exclusão de branch trancada',
  'DELETE',
  '/branches/{{branchId}}',
  undefined,
  409,
);
// A limpeza só remove os próprios registros do teste.
request('Limpeza — destrancar branch', 'PATCH', '/branches/{{branchId}}', { locked: false }, [200, 404]);
request('Limpeza — tarefa trancada', 'DELETE', '/tasks/{{lockedTaskId}}', undefined, [204, 404]);
request('Limpeza — tarefa de conclusão', 'DELETE', '/tasks/{{completionTaskId}}', undefined, 204);
request('Limpeza — branch', 'DELETE', '/branches/{{branchId}}', undefined, [204, 404]);
request('Limpeza — etiqueta', 'DELETE', '/labels/{{labelId}}', undefined, 204);
request('Limpeza — coluna de entrada', 'DELETE', '/columns/{{todoId}}', undefined, 204);
request('Limpeza — coluna de conclusão', 'DELETE', '/columns/{{doneId}}', undefined, 204);

collection(
  'bobina-mock-cenarios',
  'nexus-tasks — cenários do mock',
  'Exclusiva do mock: estado, isolamento de sessão, reset e falhas 503/429. Nenhuma dessas rotas de controle existe na API real.',
);
request(
  'Resetar sessão do mock',
  'POST',
  '/__mock/reset',
  {},
  200,
  eq('Reset confirmado', `${json}.ok`, 'true'),
  { before: init },
);
request(
  'Simular indisponibilidade',
  'GET',
  '/health',
  undefined,
  503,
  eq('Erro genérico', `${json}.error`, "'Serviço temporariamente indisponível.'"),
  { headers: [{ key: 'x-mock-scenario', value: 'unavailable' }] },
);
request(
  'Simular limite de requisições',
  'GET',
  '/health',
  undefined,
  429,
  `pm.test('Retry-After fornecido',()=>pm.expect(pm.response.headers.get('Retry-After')).to.eql('5'));`,
  { headers: [{ key: 'x-mock-scenario', value: 'rate-limited' }] },
);
request('Criar dado na sessão padrão', 'POST', '/columns', { name: 'Sessão {{runId}}' }, 201, save('todoId'));
get(
  'Outro cliente tem estado isolado',
  eq(
    'Dado da outra sessão ausente',
    `${json}.columns.some(c=>c.name==='Sessão '+pm.collectionVariables.get('runId'))`,
    'false',
  ),
  '/board',
);
current.requests.at(-1).headers = [{ key: 'x-mock-session', value: 'outra-{{runId}}' }];
get(
  'Sessão original preserva estado',
  eq('Dado presente na sessão original', `${json}.columns.some(c=>c.id===${cv('todoId')})`, 'true'),
);
request('Limpar sessão do mock', 'POST', '/__mock/reset', {}, 200);

const sharedTest =
  "if (pm.response.code !== 204) { pm.test('Resposta JSON',()=>pm.expect(pm.response.headers.get('Content-Type')).to.include('application/json')); }\n" +
  "if (pm.response.code >= 400) pm.test('Erro possui mensagem',()=>pm.expect(pm.response.json().error).to.be.a('string').and.not.empty);";
const quote = (value) => JSON.stringify(value);
const block = (text, indent) =>
  text
    .split('\n')
    .map((line) => ' '.repeat(indent) + line)
    .join('\n');
for (const c of collections) {
  for (const r of c.requests) {
    if (r.name === 'Recusar título vazio') r.example = { error: 'title: o título não pode ficar vazio' };
    if (r.name === 'Recusar etiqueta repetida') r.example = { error: 'Já existe um item com esse nome.' };
    if (r.name === 'Atualizar tasks inexistente') r.example = { error: 'Task não encontrada.' };
  }
  const dir = `${root}collections/${c.slug}`;
  await mkdir(`${dir}/.resources`, { recursive: true });
  // Remove somente requisições geradas anteriormente, evitando duplicação após renomeá-las.
  for (const name of await readdir(dir))
    if (/^\d{3}-.+\.request\.yaml$/.test(name)) await unlink(`${dir}/${name}`);
  const definition = `$kind: collection\nname: ${quote(c.name)}\ndescription: ${quote(c.description)}\nvariables:\n  - key: baseUrl\n    value: 'http://127.0.0.1:3334/api'\nauth:\n  type: noauth\nscripts:\n  - type: http:afterResponse\n    language: text/javascript\n    code: |-\n${block(sharedTest, 6)}\n`;
  await writeFile(`${dir}/.resources/definition.yaml`, definition);
  const items = [];
  for (const [i, r] of c.requests.entries()) {
    const stem =
      String(i + 1).padStart(3, '0') +
      '-' +
      r.name
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-$/, '');
    const headers = [
      ...(r.body !== undefined ? [{ key: 'Content-Type', value: 'application/json' }] : []),
      ...(r.headers ?? []),
    ];
    let yaml = `$kind: http-request\nname: ${quote(r.name)}\norder: ${(i + 1) * 1000}\nmethod: ${r.method}\nurl: '${'{{baseUrl}}' + r.path}'\n`;
    if (headers.length)
      yaml +=
        'headers:\n' +
        headers.map((h) => `  - key: ${quote(h.key)}\n    value: ${quote(h.value)}\n`).join('');
    if (r.body !== undefined)
      yaml += `body:\n  type: json\n  content: |-\n${block(JSON.stringify(r.body, null, 2), 4)}\n`;
    yaml += 'scripts:\n';
    if (r.before)
      yaml += `  - type: beforeRequest\n    language: text/javascript\n    code: |-\n${block(r.before, 6)}\n`;
    yaml += `  - type: afterResponse\n    language: text/javascript\n    code: |-\n${block(r.test, 6)}\n`;
    if (r.example) {
      const examples = `.resources/${stem}.resources/examples`;
      await mkdir(`${dir}/${examples}`, { recursive: true });
      yaml += `examples: './${examples}/'\n`;
      const code = Array.isArray(r.status) ? r.status[0] : r.status;
      await writeFile(
        `${dir}/${examples}/resposta.example.yaml`,
        `$kind: http-example\nname: Resposta\nrequest:\n  method: ${r.method}\n  url: '${'{{baseUrl}}' + r.path}'\nresponse:\n  statusCode: ${code}\n  statusText: ${quote({ 200: 'OK', 400: 'Bad Request', 404: 'Not Found', 409: 'Conflict' }[code] ?? 'Response')}\n  headers:\n    - key: Content-Type\n      value: application/json\n  body:\n    type: json\n    content: |-\n${block(JSON.stringify(r.example, null, 2), 6)}\n`,
      );
    }
    await writeFile(`${dir}/${stem}.request.yaml`, yaml);
    const exported = {
      name: r.name,
      request: {
        method: r.method,
        header: headers,
        url: '{{baseUrl}}' + r.path,
        ...(r.body !== undefined
          ? {
              body: {
                mode: 'raw',
                raw: JSON.stringify(r.body, null, 2),
                options: { raw: { language: 'json' } },
              },
            }
          : {}),
      },
      event: [
        ...(r.before
          ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: r.before.split('\n') } }]
          : []),
        { listen: 'test', script: { type: 'text/javascript', exec: r.test.split('\n') } },
      ],
    };
    if (r.example) {
      const code = Array.isArray(r.status) ? r.status[0] : r.status;
      exported.response = [
        {
          name: 'Resposta',
          originalRequest: exported.request,
          status: { 200: 'OK', 400: 'Bad Request', 404: 'Not Found', 409: 'Conflict' }[code],
          code,
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: JSON.stringify(r.example, null, 2),
        },
      ];
    }
    items.push(exported);
  }
  await mkdir(`${root}exports`, { recursive: true });
  const collectionId = createHash('md5')
    .update(c.slug)
    .digest('hex')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  await writeFile(
    `${root}exports/${c.slug}.postman_collection.json`,
    JSON.stringify(
      {
        info: {
          name: c.name,
          description: c.description,
          _postman_id: collectionId,
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        auth: { type: 'noauth' },
        variable: [{ key: 'baseUrl', value: 'http://127.0.0.1:3334/api', type: 'string' }],
        event: [{ listen: 'test', script: { type: 'text/javascript', exec: sharedTest.split('\n') } }],
        item: items,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`${c.name}: ${c.requests.length} requisições`);
}
await mkdir(`${root}environments`, { recursive: true });
for (const [slug, name, url] of [
  ['sandbox', 'nexus-tasks — Sandbox isolado', 'http://127.0.0.1:3334/api'],
  ['mock', 'nexus-tasks — Mock local', 'http://localhost:4010/api'],
]) {
  await writeFile(
    `${root}environments/${slug}.environment.yaml`,
    `name: ${quote(name)}\nvalues:\n  - key: baseUrl\n    value: ${quote(url)}\n    enabled: true\n    type: default\n`,
  );
  await writeFile(
    `${root}exports/${slug}.postman_environment.json`,
    JSON.stringify(
      {
        name,
        values: [{ key: 'baseUrl', value: url, enabled: true, type: 'default' }],
        _postman_variable_scope: 'environment',
      },
      null,
      2,
    ) + '\n',
  );
}
// Mantém os dados iniciais do mock alinhados ao seed real, sem exigir Postgres.
const handlerPath = `${root}mocks/bobina/default.js`;
const handler = await readFile(handlerPath, 'utf8');
await writeFile(
  handlerPath,
  await format(
    handler.replace(
      /\/\/ BEGIN SEED[\s\S]*?\/\/ END SEED/,
      `// BEGIN SEED (gerado por npm run postman:generate)\nconst seedColumns = ${JSON.stringify(SEED_COLUMNS)};\nconst seedLabels = ${JSON.stringify(SEED_LABELS)};\n// END SEED`,
    ),
    { ...(await resolveConfig(handlerPath)), filepath: handlerPath },
  ),
);

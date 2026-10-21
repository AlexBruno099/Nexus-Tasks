# Revisão de estrutura, banco e segurança — 19/10/2026

## Parecer

A arquitetura é adequada ao porte atual: React 18 com Vite na interface,
Fastify 5 na API, Zod para validação e PostgreSQL 17 para persistência.
TypeScript está em modo estrito. Não há necessidade técnica de trocar de
framework para organizar ou proteger esta aplicação.

Há boas proteções, mas existem pendências de segurança operacional e bugs de
integridade. A revisão considera o uso local sem login solicitado pelo usuário.
A ausência de autenticação não foi tratada como defeito nesse cenário.

Esta revisão acrescentou apenas este relatório ao projeto. Não alterou código,
dependências, permissões, credenciais ou registros do banco de uso diário.

## Achados por prioridade

### 1. Alta — testes podem apagar dados se receberem a URL errada

**Local:** `server/app.test.ts:8` e `server/app.test.ts:14`.

Antes de executar os testes, a suíte faz `DROP TABLE ... CASCADE` no banco
informado por `TEST_DATABASE_URL`. O padrão aponta para `bobina_test`, mas não
há verificação do banco efetivamente conectado nem proteção contra uma URL
apontando para `bobina` ou outro banco importante.

**Consequência:** um erro de configuração pode apagar todas as tabelas da
aplicação. A possibilidade foi identificada no código; não foi executada contra
o banco de uso diário.

**Correção recomendada:** validar `current_database()` antes de qualquer comando
destrutivo, exigir um banco dedicado e usar uma credencial de testes sem acesso
ao banco de uso diário. Apenas conferir o nome da variável de ambiente não basta.

### 2. Média — usuário da aplicação tem permissões administrativas no PostgreSQL

**Local:** `docker-compose.yml:7`, `server/db.ts:6`.

A consulta a `pg_roles` confirmou que `bobina` possui `rolsuper`, `rolcreatedb`
e `rolcreaterole`. A configuração padrão também usa uma senha previsível,
declarada no Compose e na URL padrão.

**Consequência:** uma falha futura na aplicação ou acesso indevido a essa
credencial teria alcance muito maior que o necessário. A porta restrita a
`127.0.0.1` reduz a exposição de rede, mas não limita os privilégios da conexão.

**Correção recomendada:** separar o usuário de execução, com permissões apenas
sobre os dados necessários, do usuário de migrações e do usuário de testes;
configurar uma senha própria. Isso independe de haver login na interface.
O PostgreSQL recomenda usar normalmente uma conta sem privilégios de
[superusuário](https://www.postgresql.org/docs/17/role-attributes.html).

### 3. Média — dependência com alertas de segurança conhecidos

**Local:** `package.json:22`; versão instalada `@fastify/static@8.3.0`.

`npm audit --json` terminou com código 1: um pacote classificado como alto,
com quatro avisos associados. A sugestão automática foi `10.1.6`, fora da
faixa principal declarada atualmente; a atualização precisa de verificação de
compatibilidade e dos testes de arquivos estáticos.

Os avisos envolvem [listagem de diretórios fora da raiz](https://github.com/fastify/fastify-static/security/advisories/GHSA-pr96-94w5-mx2h),
[separadores codificados](https://github.com/fastify/fastify-static/security/advisories/GHSA-x428-ghpx-8j92),
[desvio de guardas por segmentos de caminho](https://github.com/fastify/fastify-static/security/advisories/GHSA-83w8-p2f5-377r)
e [filtragem por caminhos não normalizados](https://github.com/fastify/fastify-static/security/advisories/GHSA-8pvw-jcv7-9cmj).

**Aplicabilidade atual:** a aplicação serve apenas a pasta `dist`, não habilita
listagem de diretórios e não usa guardas ou `allowedPath` para proteger arquivos
estáticos. As condições descritas nos avisos não estão configuradas aqui.
Não foi demonstrado vazamento de arquivos nesta revisão. Ainda assim, convém
atualizar a dependência para eliminar os alertas e evitar risco em mudanças futuras.

### 4. Média — exclusões ignoram a regra de branch trancada

**Local:** `server/app.ts:240` e `server/app.ts:333`.

A documentação e a mensagem da interface afirmam que nenhuma tarefa entra ou
sai de uma branch trancada. A criação e a troca de vínculo verificam essa regra,
mas os endpoints de exclusão não a verificam.

**Reprodução em banco temporário:** criar uma branch com tarefa, trancar a
branch e chamar `DELETE /api/branches/:id` retorna 204; a tarefa fica com
`branchId: null`. Excluir uma tarefa de outra branch trancada também retorna 204.

**Correção recomendada:** se a regra anunciada deve valer para exclusões,
rejeitar essas operações com 409 até destrancar a branch. Aplicar a regra na API
e incluir os dois casos na suíte de regressão.

### 5. Média — datas inválidas e IDs fora da faixa viram erro interno

**Local:** `server/app.ts:13` e `server/app.ts:16`.

A data é validada apenas pelo formato textual. IDs positivos não possuem o
limite superior das colunas `integer` do PostgreSQL.

**Reprodução em banco temporário:** criar tarefa com `dueDate: "2026-02-31"`
retorna 500; `PATCH /api/tasks/2147483648` também retorna 500.
O banco rejeita os valores, sem gravá-los, e a resposta esconde os detalhes
internos corretamente. O problema é a validação incompleta e o status incorreto.

**Correção recomendada:** validar a existência da data no calendário e limitar
IDs à faixa suportada; responder 400 para entradas inválidas.

### 6. Média — alterar o significado de uma coluna deixa conclusão inconsistente

**Local:** `server/app.ts:285`; sincronização atual em `server/app.ts:124`.

Criar e mover tarefas sincroniza `completed_at` com `columns.is_done`.
Alterar `isDone` pelo endpoint de colunas não sincroniza as tarefas existentes.

**Reprodução em banco temporário:** criar uma coluna aberta e uma tarefa nela;
alterar a coluna com `{ "isDone": true }`; a tarefa permanece com
`completedAt: null`, embora esteja em uma coluna concluída.

**Correção recomendada:** atualizar o significado da coluna e as datas das
tarefas em uma transação, incluindo a operação inversa e as tarefas arquivadas.

## Estrutura e banco

- `server/`, `web/src/` e `db/` separam bem os papéis. O tamanho atual permite
  manter a estrutura; separar rotas e serviços pode acompanhar o crescimento.
- Chaves primárias, estrangeiras e unicidades estão presentes. `task_labels`
  modela corretamente a relação de muitas tarefas para muitas etiquetas.
- `checklist` em JSONB é uma escolha razoável para uma lista pequena pertencente
  à tarefa, sem necessidade atual de consultas e relacionamentos próprios.
- Exclusões de etiquetas limpam seus vínculos; exclusão de branch preserva as
  tarefas; colunas com tarefas não podem ser excluídas.
- Há índices em `tasks(column_id, position)` e `tasks(branch_id)`.
- Falta um índice iniciado por `task_labels(label_id)`. A chave primária
  `(task_id, label_id)` cobre bem o acesso por tarefa, mas não substitui esse
  índice para buscas e exclusões por etiqueta. É uma melhoria para crescimento;
  não foi medido gargalo no volume atual.
- `migrate.ts` usa comandos idempotentes, mas não registra versões de migrações
  nem protege a sequência completa de criação e seed com uma transação e um
  bloqueio de migração. Convém evoluir isso antes de executar várias instâncias.
- Regras como título não vazio e formato de checklist ficam principalmente no
  Zod. Restrições adicionais no banco podem proteger escritas futuras por outros
  caminhos.
- `GET /api/board` carrega todo o quadro e o frontend filtra em memória. Funciona
  para o volume atual; paginação ou consultas filtradas fazem sentido ao crescer.
- Não há repositório Git nesta pasta ou em seus diretórios ancestrais. Versionar
  código e migrações facilitaria rastrear e reverter alterações.

## Proteções verificadas

- API e PostgreSQL estavam ouvindo em `127.0.0.1`, nas portas 3333 e 5434.
  O modo sem login é coerente com uso local confiável. Mudar `HOST`, publicar por
  proxy ou criar um túnel exige reavaliar quem pode acessar e alterar os dados.
- SQL usa parâmetros para valores; os nomes de colunas da atualização dinâmica
  vêm de uma lista fixa no servidor.
- Um título com conteúdo de SQL foi armazenado como texto; a tabela permaneceu
  intacta no teste.
- Falha de chave estrangeira ao inserir etiquetas provocou rollback: nenhuma
  tarefa parcial ficou gravada.
- Título vazio, prioridade inválida e descrição acima do limite retornaram 400.
- Erros internos retornam mensagem genérica, sem detalhes do PostgreSQL.
- Não foram encontrados usos de `dangerouslySetInnerHTML`, `innerHTML` ou
  `eval` nos fontes revisados. O conteúdo das tarefas é renderizado como texto
  pelo React.
- Os caminhos `/.env`, `/server/app.ts`, `/../.env` e `/%2e%2e/.env` não expuseram
  fonte ou variáveis de ambiente na instância de teste com arquivos estáticos.
- Um POST simples de outra origem, com JSON enviado como `text/plain`, foi
  rejeitado com 400. Isso verifica esse caso específico, sem constituir uma
  análise completa de ataques entre origens.
- Cabeçalhos como CSP, `X-Content-Type-Options` e proteção contra enquadramento
  não aparecem na resposta HTML testada. São melhorias de defesa para uma
  eventual disponibilização além do uso local.

## Verificações executadas

| Verificação                                                   | Resultado                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build -- --outDir /tmp/bobina-review-build-20261019` | Código 0; TypeScript e build Vite aprovados                                                                                     |
| `npm test` com `TEST_DATABASE_URL` isolada                    | Código 0; 9 testes aprovados, 0 falhas                                                                                          |
| Casos adicionais via `Fastify.inject` e PostgreSQL real       | Falhas 4, 5 e 6 reproduzidas; proteções acima verificadas                                                                       |
| `npm audit --json`                                            | Código 1; um pacote com classificação alta e quatro avisos                                                                      |
| `npm ls --depth=0`                                            | Código 0; dependências declaradas resolvidas                                                                                    |
| `GET http://127.0.0.1:3333/api/health`                        | HTTP 200, `{"ok":true}`                                                                                                         |
| Consultas somente de leitura no banco diário                  | 27 tarefas, 30 etiquetas e 3 branches                                                                                           |
| Coerência dos dados diários consultados                       | 0 posições ativas duplicadas por coluna; 0 divergências entre coluna e data de conclusão; 0 checklists cujo JSON não seja array |

Os testes de escrita usaram um banco novo `bobina_review_<pid>`, removido ao
final. O banco `bobina_test` existente também foi preservado. O build foi enviado
para uma pasta temporária para preservar o `dist` que já existia.

Não foram executados testes visuais em navegador, testes de carga ou restauração
de backup. A documentação contém um comando de backup manual, mas isso não
comprova que exista backup automático ou que uma restauração já tenha sido testada.
Os testes aprovados cobrem os cenários descritos, sem garantir ausência de outras
falhas. A CLI chamada `postman` nesta máquina aponta para o aplicativo Desktop,
e não para a CLI de requisições; a verificação da API usou a suíte nativa e
`Fastify.inject`, sem instalação adicional ou publicação externa.

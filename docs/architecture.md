# Arquitetura

## Backend

`server/src/index.ts` valida configuração, abre o pool e inicia o servidor.
`app.ts` compõe plugins e módulos, permitindo testes via Fastify inject sem abrir
uma porta. Encerramento por SIGINT/SIGTERM fecha o servidor e as conexões.

Cada módulo de escrita contém:

- `routes.ts`: método, caminho, validação dos parâmetros/corpo e status HTTP.
- `schema.ts`: contrato de entrada Zod e tipos inferidos.
- `service.ts`: regras, transações, bloqueios e erros de domínio.
- `repository.ts`: SQL parametrizado e transformação de linhas em contratos de saída.

O módulo de quadro compõe leituras dos repositórios. Compartilhamento entre módulos
usa serviços/repositórios explícitos; não há importações de rotas entre módulos.
Não foram adicionadas camadas de controller ou interfaces sem uma necessidade concreta.

A compatibilidade dos endpoints `/api/...` foi preservada. Correções deliberadas:
datas impossíveis e IDs além do int32 passam a retornar 400; exclusão de branch
trancada ou de suas tarefas retorna 409; alterar `isDone` sincroniza `completedAt`
as tarefas ativas e arquivadas na mesma transação.

Transferência e exclusão de tarefas bloqueiam primeiro as branches e depois a
tarefa, seguindo a ordem da FK de exclusão da branch. Uma mudança concorrente do
vínculo retorna 409 para o cliente atualizar. Criação e movimentação serializam a
ordenação na coluna de destino. Isso não representa um teste de carga.

## Frontend

`web/src/app/` coordena telas, navegação, estado do servidor e notificações.
`app/hooks/useWorkspace.ts` mantém o quadro, cancela leituras obsoletas e ordena
as mutações. `app/api.ts` compõe as chamadas das funcionalidades.

`features/{board,tasks,branches,labels,columns}/` mantém chamadas HTTP, componentes
e estilos específicos. Componentes podem usar outra funcionalidade quando existe
uma relação direta: o quadro usa cards de tarefas e o modal usa etiquetas.
As funcionalidades não importam a camada `app/`.

`shared/` contém infraestrutura de frontend reutilizável: transporte HTTP, fila,
autosave, foco dos diálogos e utilitários. A pasta raiz `shared/` contém contratos
sem dependências do servidor e limites dos campos. O lint proíbe importar o backend
no frontend.

O CSS foi separado por responsabilidade e funcionalidade. `app/styles/index.css`
mantém a ordem original de carregamento e aplica os ajustes responsivos por último.
A organização das flags dos repositórios e o visual existente foram preservados.

## Banco

`001-initial.sql` reconhece o esquema existente com comandos idempotentes;
`002-label-index.sql` adiciona o índice da FK `task_labels.label_id`.
`schema_migrations` registra nome, checksum SHA-256 e data. Migrações pendentes e
cadastro inicial são transacionais e protegidos por advisory lock. Seeds são
aplicados apenas na primeira migração e quando as tabelas correspondentes estão
vazias; reiniciar a API não recria etiquetas removidas.

Conta administrativa: apenas provisionamento e migrações. Conta de execução:
CONNECT, USAGE no schema, CRUD nas cinco tabelas do domínio e acesso às sequências.
A API recusa contas administrativas, proprietárias do banco ou com CREATE no schema.
A conta da API não altera o histórico das migrações.

Os testes usam `server/testing/database.ts` para criar banco e login únicos,
aplicar migrações como administrador e testar a API com o login restrito. A limpeza
usa somente identificadores aleatórios gerados internamente, nunca o nome de banco
fornecido em uma URL. A ferramenta Postman reutiliza o mesmo isolamento.

## Build e GitHub

O build verifica TypeScript, compila o frontend com Vite em `dist/web/` e empacota
os módulos do backend com esbuild em `dist/server/`, mantendo pacotes Node externos.
As migrações SQL acompanham o artefato do servidor. `npm start` usa Node diretamente.

ESLint e Prettier têm configurações versionadas. A CI usa PostgreSQL 17 efêmero,
conta restrita nos testes e coleções reais/simuladas. Dependabot acompanha npm e
GitHub Actions. Nenhuma execução publica dados no Postman ou faz deploy.

# nexus-tasks

Quadro de tarefas com colunas arrastáveis, etiquetas, checklist, prazos, prioridades,
branches organizadas por repositório, lista e arquivo. React + TypeScript no frontend;
Fastify + PostgreSQL no backend. Uso local sem login.

## Começar

Requisitos: Node 22.22 (veja `.nvmrc`), npm e Docker.

```bash
npm ci
npm run db:up
npm run db:setup
npm run dev
```

A API escuta em `127.0.0.1:3333` e o frontend em `http://localhost:5173`.
`db:setup` aplica migrações e gera `.env` com uma conta de banco restrita e senha
aleatória. Execute novamente após novas migrações locais; a configuração existente é
reutilizada. Não apaga tarefas, etiquetas, branches ou colunas existentes.

Para uso diário com a interface compilada:

```bash
npm run build
npm start
```

Abra `http://localhost:3333`. A produção executa JavaScript compilado em
`dist/server/` e serve a interface de `dist/web/`; não depende do executor TypeScript.
As migrações são explícitas: a API não usa uma conta administrativa nem executa DDL
na inicialização. Para outro ambiente, use `MIGRATION_DATABASE_URL=... npm run db:migrate`
e configure `DATABASE_URL` com uma conta restrita. Detalhes em [SECURITY.md](SECURITY.md).

## Estrutura

```text
server/
  src/
    config/                 # validação de ambiente
    database/               # pool, transações, seeds e migrações SQL versionadas
    http/                   # erros e validações comuns
    modules/
      board/                # leitura do quadro e health check
      tasks/                # routes, schema, service e repository
      branches/
      labels/
      columns/
    app.ts                  # composição Fastify
    index.ts                # inicialização e encerramento
  tests/                    # integração da API e migrações
  testing/                  # bancos temporários exclusivos para testes
web/
  src/
    app/                    # composição de telas, estado, topo e estilos globais
    features/               # board, tasks, branches, labels e columns
    shared/                 # HTTP, fila de gravações, hooks e utilitários
  tests/                    # cliente HTTP e ordem das gravações
shared/                     # contratos TypeScript e limites usados pelos dois lados
postman/                    # coleções, ambientes, exports e mock com estado
scripts/                    # build, configuração do banco e verificações da API
.github/                    # CI, Dependabot e modelo de pull request
```

Um único `package.json` instala o projeto. Backend e frontend têm responsabilidades
separadas; o frontend importa apenas contratos e limites da pasta raiz `shared/`.
Veja as regras de dependência em [docs/architecture.md](docs/architecture.md).

## Verificação

```bash
npm run check       # lint, formatação, build, testes backend/frontend e lint Postman
npm run check:api   # coleções principal e regressões, contra API real isolada e mock
npm audit --audit-level=high
```

Os testes criam bancos e contas com nomes exclusivos e removem somente aquilo que
criaram. Nunca apagam tabelas do banco informado por uma variável de ambiente.
`TEST_ADMIN_DATABASE_URL` permite escolher outro servidor PostgreSQL de testes;
na ausência dela é usada a conexão administrativa local. Essa conta precisa de
CREATE DATABASE e CREATE ROLE. `TEST_DATABASE_URL` deixou de ser utilizada.

A CI repete essas verificações em pushes e pull requests, usando PostgreSQL
17 descartável. Os resultados locais e os limites da verificação estão em
[docs/validation-2026-10-19.md](docs/validation-2026-10-19.md).

## Interface

- `N`: nova tarefa na primeira coluna; `/`: buscar.
- Na criação rápida, `#stone #sg-pdv` aplica etiquetas pelo nome.
- Com um card focado: Enter abre; Espaço pega/solta; setas movem.
- Etiquetas do mesmo grupo somam; grupos diferentes restringem a busca.
- Repositórios aparecem como flags pesquisáveis. Clicar mostra somente suas branches.
  A seleção é lembrada e a criação rápida usa o repositório selecionado.
- Branches têm página própria, cor, notas, andamento e tarefas agrupadas por status.
  Uma branch trancada não recebe/perde tarefas nem pode ser excluída; para editar
  nome, cor e notas, é preciso destrancar. A API aplica essas regras.
- O botão **Atualizar dados** recarrega o quadro. Gravações seguem a ordem das ações
  e falhas exibem mensagens e opções de recuperação.

## Banco e backup

Os nomes técnicos antigos foram preservados para manter o volume e os dados:

- Volume: `bobina_bobina-data`; container: `bobina-postgres`; banco: `bobina`.
- `npm run db:down` para o container sem remover o volume.
- Backup: `docker exec bobina-postgres pg_dump -U bobina bobina > backup.sql`.
- As migrações em `server/src/database/migrations/` têm histórico, checksum e trava
  entre processos. Uma migração aplicada deve permanecer imutável.
- O backup anterior à reorganização está em `backups/`, ignorada pelo Git.

## Postman e simulação

Instruções de importação no aplicativo em [postman/README.md](postman/README.md).

```bash
npm run api:mock      # simulação sem banco em http://localhost:4010/api
npm run api:sandbox   # API real com banco temporário em :3334
```

Para conectar o frontend ao mock em outro terminal:

```bash
NEXUS_API_TARGET=http://localhost:4010 npm run dev:web
```

Para o sandbox, use `NEXUS_API_TARGET=http://127.0.0.1:3334`.
A variável configura somente o proxy de desenvolvimento; credenciais ficam no
backend. `BOBINA_API_TARGET` permanece aceito como compatibilidade.

Colaboração e convenções: [CONTRIBUTING.md](CONTRIBUTING.md).

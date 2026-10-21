# Postman — nexus-tasks

Coleções executáveis, ambientes e mock local da API. Os artefatos são locais;
não é necessário publicar um workspace nem fornecer uma chave do Postman.

## Começar pelo aplicativo Postman

1. No terminal do projeto, execute `npm run api:mock`. O mock responde em
   `http://localhost:4010/api`, com dados fictícios em memória e sem PostgreSQL.
2. No Postman, clique em **Import** e selecione os arquivos da pasta `exports/`:
   - `bobina-api.postman_collection.json`: fluxo principal, 58 requisições.
   - `bobina-regressoes.postman_collection.json`: regressões de segurança e consistência,
     27 requisições, incluindo preparação e limpeza.
   - `bobina-mock-cenarios.postman_collection.json`: reset, sessões e falhas,
     7 requisições; usar exclusivamente no mock.
   - `mock.postman_environment.json`: ambiente **nexus-tasks — Mock local**.
   - `sandbox.postman_environment.json`: ambiente **nexus-tasks — Sandbox isolado**.
3. Selecione **nexus-tasks — Mock local** no seletor de ambientes.
4. Abra **nexus-tasks — API completa**, clique em **Run collection** e execute a
   coleção inteira na ordem original. Os identificadores são preenchidos pelas
   respostas. A última etapa confere a limpeza dos registros criados.

Para testar a API real pelo aplicativo, execute `npm run db:up` e
`npm run api:sandbox`, selecione **nexus-tasks — Sandbox isolado** e rode a coleção.
A API real temporária escuta em `http://127.0.0.1:3334/api`. Ctrl+C encerra o
servidor e remove apenas o banco temporário criado por esse comando.
Os dados desse ambiente são descartáveis; o servidor diário na porta 3333
continua separado.

Requisições posteriores à preparação dependem dos IDs obtidos nas primeiras
etapas. Para usar **Send** individualmente, execute primeiro a saúde da API e
as criações necessárias, mantendo o mesmo ambiente.

## Testes pelo terminal

```bash
npm run test:api                  # API real + banco novo; remove o banco ao terminar
npm run test:api:mock             # Mock: fluxo principal + cenários de erro e sessões
npm run test:api:regressions      # API real: datas, IDs, exclusões e conclusão
npm run test:api:mock:regressions # Mock: mesmas regressões obrigatórias
npm run test:api:export           # Valida também os JSONs importáveis contra o mock
npm run postman:lint             # Validação estrutural das coleções e ambientes YAML
```

O fluxo real precisa do PostgreSQL iniciado e de uma conexão administrativa que
possa criar bancos e contas temporárias. O runner lê `TEST_ADMIN_DATABASE_URL`,
depois `MIGRATION_DATABASE_URL` e, na ausência de ambas, a conexão local padrão.
Cria um banco `nexus_test_<uuid>` e uma conta de execução restrita; nunca apaga
tabelas do banco informado. Ao terminar, remove somente o banco e a conta criados.
`TEST_DATABASE_URL` não é mais utilizada. O servidor diário não é alterado.

O runner escolhe uma porta livre. `api:sandbox` usa a porta fixa 3334 para o
aplicativo Postman. `api:mock` usa 4010; se estiver ocupada, o comando falha e
permite identificar o conflito. Os comandos de teste escolhem uma porta livre
para o mock. Os processos iniciados pelos testes são encerrados no fim.

Os relatórios de texto ficam em `postman/reports/`, ignorada pelo Git. As
execuções usam `--no-report-events` e o mock usa `--no-history` para não publicar
resultados ou histórico. A CLI 1.75 pode exibir um aviso de ausência de login;
as operações locais acima funcionaram sem login nesta verificação.

## Cobertura e resultados verificados em 19/10/2026

| Alvo                                     | Requisições | Asserções | Falhas | Saída |
| ---------------------------------------- | ----------: | --------: | -----: | ----: |
| API real, fluxo principal                |          58 |       175 |      0 |     0 |
| Mock, fluxo principal                    |          58 |       175 |      0 |     0 |
| Mock, cenários                           |           7 |        21 |      0 |     0 |
| JSON importável, fluxo principal no mock |          58 |       175 |      0 |     0 |
| JSON importável, cenários no mock        |           7 |        21 |      0 |     0 |
| API real, regressões                     |          27 |        67 |      0 |     0 |
| Mock, regressões                         |          27 |        67 |      0 |     0 |

O fluxo principal cobre as 15 operações existentes: saúde e quadro; criar,
editar, mover, arquivar, restaurar e excluir tarefas; CRUD de etiquetas,
colunas e branches. Confere os tipos da tarefa, os campos preservados em PATCH,
ordenação, conclusão, persistência, remoção de vínculos e a limpeza das fixtures.
Inclui respostas 400, 404 e 409, duplicidades e rollback de criação inválida.

A coleção de regressões agora deve passar. Ela verifica conclusão ao alterar
`isDone`, datas inexistentes, limite de IDs, exclusão de tarefa e de branch
trancadas, datas bissextas e reabertura da coluna. As falhas identificadas na
[auditoria original](../docs/auditoria-2026-10-19.md) foram corrigidas na API e no mock.

As três coleções YAML e os dois ambientes passaram no lint sem erros ou avisos.
TypeScript e a sintaxe dos scripts também passaram. O início e o encerramento
do Sandbox foram verificados, incluindo a remoção do banco ao usar Ctrl+C.

## Como o mock funciona

`mocks/bobina/config.yaml` configura um mock oficial do Postman, com
`interceptRequests: true`. O cenário padrão usa `pm.state` para manter colunas,
etiquetas, branches e tarefas entre requisições. O seed vem dos mesmos dados
de `server/src/database/seeds.ts`. Aceita tanto `/api/...` quanto `/...` para permitir
uso direto e redirecionamento pela CLI.

| Cabeçalho ou rota                 | Efeito                            |
| --------------------------------- | --------------------------------- |
| Sem `x-mock-scenario`             | Comportamento normal da API       |
| `x-mock-scenario: unavailable`    | Retorna 503 com mensagem genérica |
| `x-mock-scenario: rate-limited`   | Retorna 429 com `Retry-After: 5`  |
| `x-mock-session: cliente-a`       | Isola o estado desse cliente      |
| `POST /api/__mock/reset` com `{}` | Restaura o seed da sessão atual   |

As rotas de controle e os cenários de falha existem apenas no mock. Para
verificar cabeçalhos de cenário por requisição, os testes iniciam o mock e usam
sua URL diretamente: o mapeamento `--use-mock` fixa um cenário para a execução.

O mock acompanha o contrato corrigido da API. Foi
validado com a mesma coleção usada contra a API real. As mensagens de validação
podem ser mais simples que as do Zod; os status, campos e efeitos dos fluxos
testados coincidem. O mock não executa SQL, migrações ou transações reais e não
valida concorrência, desempenho, permissões do banco ou resistência a ataques.

## Manutenção

- `scripts/generate-postman.mjs` é a fonte das requisições, scripts de teste e
  ambientes. `npm run postman:generate` gera os YAMLs v3 em `collections/`, os
  JSONs v2.1 em `exports/` e atualiza o seed embutido no mock.
- Edite a fonte e regenere para manter as versões equivalentes. Os handlers
  do mock são mantidos em `mocks/bobina/` e precisam acompanhar mudanças na API.
- `postman-cli` está instalado como dependência de desenvolvimento do projeto.
  Os comandos npm usam essa CLI, sem substituir o atalho do Postman Desktop
  que já existia no sistema.
- Não há credenciais de banco nas coleções ou ambientes exportados.

Referências: [coleções Git-native v3](https://learning.postman.com/docs/use/native-git/overview/)
e [mocks com JavaScript](https://learning.postman.com/docs/design-apis/mock-apis/local-mock-servers/).

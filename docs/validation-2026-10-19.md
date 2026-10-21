# Verificação após reorganização — 19/10/2026

## Alterações

Backend modular com HTTP, regras e SQL separados; frontend organizado em app,
features e shared; contratos e limites compartilhados; build JavaScript do
servidor; migrações SQL com histórico e checksum; conta de execução restrita;
encerramento das conexões; cabeçalhos de segurança; lint, formatação e CI.

## Auditoria original

| Achado                                       | Tratamento                                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testes apagavam tabelas da URL informada     | Removida essa estratégia. Testes e Postman criam banco e login exclusivos; limpam apenas esses identificadores.                                                             |
| API usava superusuário                       | Setup local cria login com senha aleatória e CRUD somente nas tabelas de domínio. Inicialização recusa conta administrativa. Testes demonstram rejeição e proibição de DDL. |
| Alertas em @fastify/static                   | Atualizado para 10.1.6; audit atual sem vulnerabilidades conhecidas.                                                                                                        |
| Exclusões ignoravam branch trancada          | Services de tarefas/branches verificam bloqueios dentro de transação; retornam 409.                                                                                         |
| Datas impossíveis/IDs grandes retornavam 500 | Validação de calendário e limite int32 antes do SQL; retornam 400.                                                                                                          |
| isDone não sincronizava conclusão            | Coluna e tarefas ativas/arquivadas são sincronizadas na mesma transação.                                                                                                    |

A credencial administrativa legada do Docker local continua disponível exclusivamente
para manutenção do ambiente existente. Isso preserva o container e o volume; ela
não deve ser reutilizada em uma implantação. Orientações em [SECURITY.md](../SECURITY.md).

## Verificações locais

- `npm ci`: instalação reproduzida a partir do lockfile.
- `npm run check`: lint sem avisos, formatação, TypeScript, build, 16 testes backend,
  9 testes frontend e lint de todas as coleções/ambientes.
- `npm run check:api`: todas as coleções obrigatórias aprovadas nos alvos abaixo.
- `npm run test:api:export`: JSONs importáveis também executados no mock.
- `npm audit --audit-level=high`: zero vulnerabilidades conhecidas nesta execução.
- `npm run db:setup` repetido sem trocar a conta de execução existente.
- `.env` com permissão 0600; env, backups e relatórios ignorados pelo Git.

| Alvo                                 | Requisições | Asserções | Falhas |
| ------------------------------------ | ----------: | --------: | -----: |
| API real isolada, fluxo principal    |          58 |       175 |      0 |
| API real isolada, regressões         |          27 |        67 |      0 |
| Mock, fluxo principal                |          58 |       175 |      0 |
| Mock, regressões                     |          27 |        67 |      0 |
| Mock, cenários de erro e sessões     |           7 |        21 |      0 |
| Export JSON, fluxo principal no mock |          58 |       175 |      0 |
| Export JSON, cenários no mock        |           7 |        21 |      0 |

Os testes reais usam PostgreSQL 17 e login restrito, incluindo rollback, vínculos,
conclusão, arquivamento e validações. O mock valida o contrato simulado; não prova
permissões, concorrência ou persistência reais. Os relatórios locais ficam em
`postman/reports/`.

## Navegador

Executados o backend e o frontend compilados, com banco e conta temporários:

- Quadro carregado e tarefas de três repositórios renderizadas.
- Título e descrição editados pela interface; valores confirmados na API e
  preservados ao recarregar a página.
- Troca de flag e criação de branch no repositório selecionado.
- Arquivamento, leitura no arquivo e restauração pela interface.
- Mobile 390 × 844: largura da página de 390px, três flags e um painel de repositório.
- Nenhum erro JavaScript reportado pela ferramenta do navegador.

Nenhuma fixture foi criada no banco diário. Contagem antes/depois da reorganização:
39 tarefas, 30 etiquetas, 4 branches e 4 colunas. O backup anterior fica em
`backups/before-modularization-2026-10-19.sql`, fora do Git.

## Limites

Workflow do GitHub preparado e comandos equivalentes executados localmente; ainda
não houve uma execução no GitHub, pois o repositório local não tem remoto.
Git inicializado na branch main, sem commit ou publicação. Não foram realizados
deploy, teste de carga, pentest ou certificação de segurança. A aplicação continua
local e sem autenticação, conforme solicitado.

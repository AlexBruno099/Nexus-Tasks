# Segurança

O uso atual é local, sem autenticação, por decisão do produto. API e PostgreSQL
escutam somente em loopback por padrão. Qualquer cliente que alcance a API pode
ler e alterar tarefas; não publique essa instalação sem definir controle de acesso.

A API usa uma conta PostgreSQL restrita com senha aleatória gerada no setup local.
Não usa a conexão de migração e recusa execução com conta administrativa ou
capaz de criar objetos no schema. Migrações e provisionamento têm comandos próprios.

`.env` tem permissão 0600 e é ignorado pelo Git. A credencial administrativa legada
`bobina:bobina` permanece apenas como compatibilidade do Docker de desenvolvimento
já existente. Antes de uma implantação, provisione credenciais próprias em um
gerenciador de segredos e use contas separadas para migração e execução. Não
reutilize a credencial local ou o arquivo `.env` em produção.

Entradas HTTP são validadas com Zod, SQL usa parâmetros e operações compostas usam
transações. Branches trancadas têm bloqueio no backend. Respostas incluem CSP,
proteção contra framing e `nosniff`; logs ocultam Authorization e cookies. O suporte
a estilos inline na CSP é necessário para cores e animações da interface. HTTPS,
HSTS, backups externos e controles de rede devem ser configurados na hospedagem.

Os testes criam bancos descartáveis e jamais limpam tabelas de um banco informado.
Use `TEST_ADMIN_DATABASE_URL` para um PostgreSQL exclusivo em CI. A conta de teste
administrativa precisa de CREATE DATABASE e CREATE ROLE; a API testada usa outra
conta restrita. Interromper à força o processo pode deixar um banco temporário;
verifique nomes `nexus_test_<uuid>` antes de qualquer limpeza manual.

Execute `npm audit --audit-level=high` e mantenha o lockfile atualizado. A auditoria
original em `docs/auditoria-2026-10-19.md` é histórica; o estado após as correções
está em `docs/validation-2026-10-19.md`. Os testes não constituem um pentest nem
uma certificação de segurança. Relate vulnerabilidades de forma privada ao
responsável pelo repositório, sem incluir dados reais ou senhas em issues públicas.

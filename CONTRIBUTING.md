# Contribuir

Use Node indicado em `.nvmrc`. Instale com `npm ci`, inicie o PostgreSQL com
`npm run db:up`, configure o banco com `npm run db:setup` e execute `npm run dev`.

Antes de abrir uma pull request:

```bash
npm run format
npm run check
npm run check:api
```

Mantenha regras de negócio no service, SQL no repository e validação HTTP no
schema do módulo. No frontend, mudanças de uma funcionalidade ficam em `features/`;
coordenação entre telas fica em `app/`; infraestrutura genérica fica em `shared/`.

Para mudar o banco, adicione um arquivo `NNN-descricao.sql` em
`server/src/database/migrations/`. Nunca edite uma migração já aplicada. Considere
bancos com dados, não apenas instalações novas. Execute `db:setup` localmente;
em implantação, migre com a conta administrativa antes de iniciar a API restrita.

Para mudar o contrato da API, atualize `scripts/generate-postman.mjs`, o mock em
`postman/mocks/bobina/` e os testes apropriados. Rode `npm run postman:generate`
e valide API real e mock. Os arquivos YAML e JSON das coleções são gerados;
não devem ser editados independentemente.

Não versione `.env`, backups, relatórios locais ou credenciais. O Git foi
inicializado localmente na branch `main`; conectar um remoto e publicar mudanças
são etapas separadas. Use branches e pull requests no GitHub, com a CI obrigatória
nas regras de proteção da branch após conectar o repositório.

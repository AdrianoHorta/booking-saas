# Supabase cloud

## Arquitetura

React corre no computador com Vite e será publicado na Vercel. Auth, PostgreSQL
e Data API ficam no Supabase cloud. Docker não é necessário para este fluxo.

## 1. Criar um projeto

1. Entrar em https://supabase.com/dashboard e criar um projeto na tua organização.
2. Usar, por exemplo, o nome `booking-saas-dev`.
3. Escolher uma região próxima dos utilizadores previstos.
4. Gerar uma password de base de dados e guardá-la no gestor de passwords.
5. Rever as condições do plano escolhido e aguardar o projeto ficar pronto.

Usar um projeto de desenvolvimento novo, sem dados reais. Se já houver tabelas
de outra aplicação, inspecionar o schema antes de aplicar estas migrations.

O Project ID está no endereço `https://supabase.com/dashboard/project/PROJECT_REF`.
É um identificador público, diferente da password da base de dados.

## 2. Autenticar e ligar a CLI

No terminal integrado, na raiz do repositório:

```sh
npm run db:login
npx supabase link --project-ref PROJECT_REF
```

Substituir PROJECT_REF pelo identificador real, sem a URL inteira.
Concluir a autenticação no terminal/browser. Se a CLI pedir uma password,
introduzi-la no prompt privado, nunca como argumento do comando ou na conversa.
Tokens e passwords não pertencem aos ficheiros versionados.

A ligação fica em `supabase/.temp`, ignorado pelo Git. `cli-latest` é metadado
da CLI, não um ficheiro que devas editar.

## 3. Rever e aplicar migrations

```sh
npm run db:history
npm run db:plan
```

São esperadas duas migrations novas:

- `20260917000100_create_tenant_foundation.sql`
- `20260917000200_add_tenant_read_policies.sql`

Depois de rever o destino e os ficheiros:

```sh
npm run db:push
npm run db:history
```

`db:push` altera o projeto ligado. `--skip-vault` evita atualizar segredos do
Vault neste comando. Não inclui seed. `db:plan` apenas lista migrations pendentes,
não comprova a validade das policies.

Não aplicar as migrations manualmente no SQL Editor e depois repetir com push:
isso criaria objetos sem o respetivo registo no histórico da CLI.

## 4. Verificar a estrutura

No Table Editor devem existir `businesses` e `business_members`, com RLS ativo.
As tabelas devem estar vazias: ainda não implementámos onboarding.
`seed.sql` está intencionalmente vazio.

Executar `supabase/checks/tenant-security.sql` no SQL Editor. São consultas de
metadados sem escrita. Esperado: duas tabelas com RLS ativo, duas policies SELECT,
SELECT apenas para authenticated e nenhum INSERT/UPDATE/DELETE para os clientes.
Confirmar também que `private` não está nos schemas expostos da Data API.

O SQL Editor corre normalmente como administrador; esta inspeção não substitui
os testes RLS. A suite pgTAP simula os papéis reais e já passou os 29 testes.
Executar novamente com `npm run db:test:cloud`, sem Docker. O executor está
limitado ao projeto booking-saas-dev e verifica os diagnósticos de finish().

## 5. Variáveis públicas

Copiar `.env.example` para `.env.local` e preencher a URL e a publishable key
disponíveis no Dashboard (Connect/API Keys):

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_VALOR_DO_PROJETO
```

Estes valores são exemplos. Nunca usar secret key, service_role, password da base
ou access token da CLI. O frontend usa estas variáveis no cliente tipado de
autenticação. Reiniciar Vite após alterar o ficheiro.

Após aplicar migrations, `npm run db:types` grava os tipos em `src/lib/supabase/database.types.ts`.
O resultado atual já foi guardado em `src/lib/supabase/database.types.ts`,
após confirmar que a geração terminou com sucesso.

## 6. Auth na cloud

Em Authentication → URL Configuration, durante o desenvolvimento:

- Site URL: `http://localhost:5173`.
- Redirect URL: `http://localhost:5173/reset-password`.
- Redirect URL: `http://localhost:5173/auth/callback`.
- Se usares 127.0.0.1, acrescentar o respetivo endereço de recuperação.

Manter email/password e mínimo de password de 8 caracteres. Em desenvolvimento,
a confirmação está temporariamente desativada conforme [este guia](development-auth.md).
Reativá-la no projeto de produção antes do lançamento.
As páginas estão implementadas; consultar o guia da fase 3 para validação manual.
O `supabase/config.toml` não configura automaticamente o Auth remoto.

## 7. Vercel, mais tarde

- Build: `npm run build`; saída: `dist`.
- Adicionar URL e publishable key nas variáveis do ambiente apropriado.
- Atualizar Site URL e redirect de recuperação para o domínio real.
- Configurar encaminhamento das rotas SPA.
- Aplicar migrations separadamente do build frontend.

## Referências

- https://supabase.com/docs/guides/deployment/managing-environments
- https://supabase.com/docs/guides/getting-started/quickstarts/reactjs

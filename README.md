# Booking SaaS

Plataforma de reservas online para negócios que trabalham por marcação. Reúne
serviços, equipas, horários e reservas num espaço de gestão com suporte para
várias empresas por conta.

## Funcionalidades

- Página de reservas com a identidade e os contactos de cada negócio.
- Catálogo de serviços, preços, duração e profissionais associados.
- Horários semanais, bloqueios de disponibilidade e agenda por profissional.
- Confirmação de reservas, reagendamento pela equipa e cancelamento com prazo configurável.
- Ligação privada para o cliente consultar ou cancelar a sua reserva.
- Perfis pessoais, fotografias, logótipos e permissões de acesso por empresa.
- Atualização da agenda em tempo real e indicadores por período e serviço.

Os emails de reservas dependem da configuração do fornecedor e da ativação por
empresa. A integração Google Calendar permanece desativada na interface até à
configuração OAuth e validação real. Ver [integrações](docs/phase-13-integrations.md).

## Desenvolvimento

Stack: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query,
React Hook Form, Zod e Supabase (Auth, PostgreSQL, Storage e Realtime).

Usar Node.js 24 e npm. Copiar `.env.example` para `.env.local` e preencher
`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores do ambiente
pretendido. Usar apenas a chave pública no frontend.

```sh
npm ci
npm run dev
```

## Validação

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

O build de produção fica em `dist`. Playwright usa um build separado em
`dist-e2e`, com APIs simuladas e cenários em desktop e mobile. Os testes locais
não validam serviços externos reais. A CI executa lint, testes, build e browser
sem credenciais cloud. Ver [testes de browser](docs/browser-tests.md).

## Publicação

A configuração Vercel está em `vercel.json`: build Vite, saída `dist`, headers de
segurança e fallback SPA para navegação direta. Definir as variáveis públicas no
ambiente Vercel antes do build. Migrations e Edge Functions são publicadas
separadamente do frontend.

A [checklist de publicação](docs/release-checklist.md) reúne os passos de
configuração e verificação no domínio final, incluindo autenticação e emails.

Com a CLI Supabase ligada ao destino correto:

```sh
npm run db:plan
npm run db:push
npm run db:history
```

`db:plan` permite rever as migrations antes de as aplicar. Os comandos
`db:test:cloud` e `db:test:concurrency` destinam-se apenas ao ambiente de
desenvolvimento. Ver [configuração cloud](docs/supabase-cloud.md).

## Organização

- `src/app`: navegação, layouts e providers.
- `src/features`: reservas, empresas, serviços, profissionais e restantes funcionalidades.
- `src/components`: componentes de interface partilhados.
- `supabase`: migrations, funções e testes de base de dados.
- `e2e`: percursos de browser e verificações de acessibilidade.
- `docs`: operação, arquitetura e histórico de implementação.

As páginas públicas são `/` e `/features`. As antigas ligações `/project` e
`/demo` encaminham para a apresentação atual. O código histórico em
`src/features/demo` não é importado nem incluído no build publicado.

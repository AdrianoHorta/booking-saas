# Booking SaaS

Projeto de portefólio de uma plataforma de reservas multiempresa, desenvolvido
por etapas com foco em arquitetura, segurança e aprendizagem.

## Estado atual

Frontend inicial concluído. Inclui página inicial, página sobre o projeto,
navegação, página não encontrada, tema responsivo e componentes reutilizáveis.

Supabase ligado ao projeto booking-saas-dev na cloud, com migrations de
empresas/membros, onboarding, services, employees, horários, disponibilidade, confirmação de reservas, catálogo, disponibilidade públicos, controlo de publicação e gestão de membros aplicadas, tipos gerados e 554 testes SQL
aprovados. Este fluxo não precisa de Docker.

Autenticação implementada: registo, login, recuperação de password, sessão e
logout. No projeto dev, o registo permite sessão imediata sem confirmação de email;
registo e login foram verificados contra a cloud com uma conta temporária removida
no fim. Ver [modo de desenvolvimento](docs/development-auth.md).
A recuperação por email continua a exigir validação manual e configuração SMTP.
A confirmação de reservas no servidor está criada e testada com concorrência. Owner/admin podem gerir a publicação e abrir `/book/:slug` na página da empresa. O formulário público inclui seleção, contactos, revisão, confirmação e recuperação de pedidos incertos. O percurso manual completo no browser contra a cloud e a demo continuam pendentes.

A secção Acesso à empresa permite adicionar contas registadas pelo email, gerir
permissões e retirar acesso sem apagar profissionais ou reservas. O formulário
de colaboradores identifica as contas pelo email. Ver o [roteiro de associação
do Miguel e demonstração](docs/members-and-demo.md). Suite frontend/API: 199 testes.

Já existe consulta privada de reservas em `/dashboard/:businessId/reservations`:
employee vê a sua agenda; owner/admin veem as reservas da empresa. Inclui contactos,
filtros de datas/estado e paginação. Ver [fase 10](docs/phase-10.md).

A Fase 5 — Services está concluída na validação automatizada: catálogo, criação,
edição e ativação/desativação, com testes RLS na cloud. Ver o [fecho da Fase 5](docs/phase-5.md)
para resultados e limites da validação.

## Stack atual

- React e TypeScript com modo strict.
- Vite e Tailwind CSS através do plugin Vite.
- React Router para navegação.
- Oxlint para análise estática.

Supabase Cloud suporta Auth, PostgreSQL e RLS. O acesso a dados usa TanStack
Query; os formulários usam React Hook Form e Zod. Deploy Vercel fica para uma fase posterior.

A CLI Supabase está instalada como dependência de desenvolvimento com versão fixa.

## Executar localmente

Ambiente validado nesta etapa: Node.js 24.19.0 e npm 11.19.0.

```sh
npm ci
npm run dev
```

Abre o URL indicado pelo Vite. Copia `.env.example` para `.env.local` e preenche
a URL e publishable key do Supabase. Sem configuração, as páginas públicas
funcionam mas os formulários de autenticação apresentam indisponibilidade.

```sh
npm run lint
npm test
npm run build
npm run preview
```

`build` verifica os tipos e gera os ficheiros de produção em `dist`.
`preview` serve esse build localmente; não é um servidor de produção.

## Organização

```text
src/
  app/              # Rotas e layouts
  components/       # UI partilhada e feedback
  features/home/    # Páginas públicas iniciais
  styles/           # Tema e estilos globais
  main.tsx          # Entrada React
docs/
  phase-1.md        # Explicação da implementação e exercícios
```

Lê o [guia da fase 1](docs/phase-1.md) para perceber o fluxo, os tipos,
as decisões e os testes manuais.

A [direção visual](docs/visual-direction.md) documenta a identidade quente,
com títulos serifados e laranja queimado como destaque.

## Supabase cloud

Segue o [guia cloud](docs/supabase-cloud.md) para criar o projeto e ligar a CLI.
Depois de ligar o projeto correto:

```sh
npm run db:plan
npm run db:push
npm run db:history
```

`db:plan` mostra as migrations pendentes; `db:push` aplica-as no projeto ligado.
As migrations não são executadas durante o build Vercel. `npm run db:test:cloud`
executa a suite SQL no projeto de desenvolvimento, com rollback das fixtures.
O [guia da fase 2A](docs/phase-2.md) explica o modelo e RLS.

O [guia da fase 3](docs/phase-3.md) explica a autenticação, os redirects no
Dashboard, os testes realizados e o percurso manual com emails reais.

## Roadmap

- [x] Fase 1 — Base do frontend e navegação pública.
- [x] Fase 2 — Supabase, migrations e isolamento multiempresa.
- [x] Fase 3 — Autenticação (validação de recuperação por email ainda pendente).
- [x] Fase 4 — Criação de empresas e memberships.
- [x] Fase 5 — Services; [validação e fecho](docs/phase-5.md).
- [x] Fase 6 — Employees: gestão e validação automatizada; [detalhes](docs/phase-6.md).
- [x] Fase 7 — Working hours / schedules: gestão e validação automatizada; [detalhes](docs/phase-7.md).
- [x] Fase 8 — Availability engine e consulta privada; [validação e limites](docs/phase-8.md).
- [x] Fase 9 — Public booking flow implementado e validado automaticamente; percurso manual cloud pendente. Ver [detalhes](docs/phase-9.md).
- [ ] Fase 10 — Dashboard: consulta privada de reservas implementada; resumo pendente.
- [ ] Fase 11 — Booking management.
- [ ] Fase 12 — Realtime.
- [ ] Fase 12.x A — Google OAuth/calendar connection por employee.
- [ ] Fase 12.x B — SaaS → Google event sync.
- [ ] Fase 12.x C — Update/cancel sync.
- [ ] Fase 12.x D — Mais tarde: Google busy time → availability engine.
- [ ] Analytics.
- [ ] Demo mode.
- [ ] Testes de integração/E2E completos (testes acompanham também cada fase).
- [ ] Polish.
- [ ] Deploy.
- [ ] README, screenshots e apresentação do portefólio.

O [design Google Calendar](docs/google-calendar-architecture.md) define os contratos
para employees, schedules, availability e bookings. Não há implementação Calendar nesta etapa.

## Segurança

Não guardar segredos no código nem em variáveis `VITE_*`, que são públicas no
browser. O backend terá RLS e constraints; as rotas do frontend não constituem
uma barreira de autorização.

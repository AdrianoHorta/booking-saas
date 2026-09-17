# Booking SaaS

Projeto de portefólio de uma plataforma de reservas multiempresa, desenvolvido
por etapas com foco em arquitetura, segurança e aprendizagem.

## Estado atual

Frontend inicial concluído. Inclui página inicial, página sobre o projeto,
navegação, página não encontrada, tema responsivo e componentes reutilizáveis.

Fase 2A preparada: CLI Supabase, migrations de empresas/membros e testes RLS.
O projeto booking-saas-dev está ligado na cloud, com duas migrations aplicadas,
tipos gerados e 29 testes SQL aprovados. Este fluxo não precisa de Docker.

Autenticação implementada: registo, login, recuperação de password, sessão e
logout. No projeto dev, o registo permite sessão imediata sem confirmação de email;
registo e login foram verificados contra a cloud com uma conta temporária removida
no fim. Ver [modo de desenvolvimento](docs/development-auth.md).
A recuperação por email continua a exigir validação manual e configuração SMTP.
Reservas e demo ainda não estão implementadas.

## Stack atual

- React e TypeScript com modo strict.
- Vite e Tailwind CSS através do plugin Vite.
- React Router para navegação.
- Oxlint para análise estática.

Supabase e Vercel fazem parte da arquitetura planeada.

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

- [x] Base do frontend e navegação pública.
- [ ] Supabase, migrations e isolamento multiempresa.
- [ ] Autenticação e criação de empresas.
- [ ] Serviços, colaboradores e horários.
- [ ] Disponibilidade e reservas sem sobreposições.
- [ ] Dashboard, gestão, realtime e indicadores.
- [ ] Demo, testes de integração e acabamento visual.
- [ ] Deploy, screenshots e apresentação final do portefólio.

## Segurança

Não guardar segredos no código nem em variáveis `VITE_*`, que são públicas no
browser. O backend terá RLS e constraints; as rotas do frontend não constituem
uma barreira de autorização.

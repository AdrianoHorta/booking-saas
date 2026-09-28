# Fecho do MVP e publicação

Atualização de 24 de setembro de 2026: o utilizador confirmou que Vercel e Supabase
já estão configurados e os percursos existentes foram testados na app publicada.
A prioridade passou para integrações e indicadores, com design no fim.
O código da [fase 13](phase-13-integrations.md) está implementado e o backend
publicado no Supabase ligado, com cron ativo; falta ativar fornecedores e atualizar o frontend.
As listas de publicação abaixo servem de referência, não de pedido para refazer o deploy inicial.

## Implementado

- [x] Contas, empresas, membros e permissões owner/admin/employee.
- [x] Serviços, profissionais, horários, bloqueios e disponibilidade.
- [x] Reserva pública com prevenção de sobreposição e recuperação de pedidos.
- [x] Agenda privada, resumo, cancelamento com prazo e reagendamento.
- [x] Ligação privada para o cliente consultar/cancelar sem conta.
- [x] Atualização Realtime da área privada com recuperação por nova consulta.
- [x] Demonstração isolada em `/demo`, sem contas ou serviços externos.
- [x] Testes de acessibilidade, teclado e percursos desktop/mobile.
- [x] Playwright sobre build de produção em `dist-e2e`, com APIs simuladas.
- [x] Workflow GitHub Actions: lint, Vitest, build e Playwright, sem segredos.
- [x] Configuração Vercel: build, saída, rotas SPA e headers.
- [x] Página de apresentação do projeto atualizada com o estado real.

## Para fechar hoje: portefólio

1. **Publicar a revisão atual.** Rever e guardar as alterações no Git, executar a
   CI e publicar no projeto Vercel pretendido. A configuração local está preparada;
   a execução remota do workflow e o deploy desta revisão não foram verificados.
2. **Confirmar o domínio.** Abrir `/`, `/project` e `/demo` diretamente e recarregar
   cada página. Executar uma reserva, reagendamento e cancelamento na demonstração,
   também no telemóvel. Os testes locais não verificam o encaminhamento da Vercel.
3. **Apresentação.** Acrescentar o URL publicado e screenshots ao README e gravar
   um percurso curto da demonstração. Usar apenas os exemplos fictícios.

A demonstração funciona sem variáveis Supabase. Para oferecer também os percursos
reais de contas e reservas, concluir os pontos da secção seguinte antes de os
apresentar como prontos para utilização real.

## Para abrir contas e reservas reais

- [ ] Definir o projeto Supabase de produção e aplicar as migrations nesse destino.
  O projeto documentado atualmente é `booking-saas-dev`; não confundir os dois.
- [ ] Configurar na Vercel `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_PUBLISHABLE_KEY` do destino correto e voltar a fazer build/deploy.
  Estas variáveis são públicas; segredos de servidor não pertencem ao frontend.
- [ ] No Supabase Auth, configurar Site URL e redirects exatos do domínio publicado:
  `/auth/callback` e `/reset-password`. Ver [redirects oficiais](https://supabase.com/docs/guides/auth/redirect-urls).
- [ ] Ativar confirmação de email em produção, configurar SMTP e verificar registo,
  confirmação e recuperação de password numa caixa de correio real.
  Ver [configuração SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- [ ] Executar o percurso completo com dados de teste na cloud: criar empresa,
  serviço, profissional e horário; publicar a página; reservar como visitante;
  consultar na equipa; reagendar; cancelar pela ligação privada e confirmar vaga livre.
- [ ] Validar Realtime em duas janelas e recuperação após desligar/ligar a rede.
  Confirmar que outra empresa não vê as reservas e que employee só vê a sua agenda.

O cliente precisa de guardar a ligação privada apresentada no recibo. Ainda não
há envio automático por email da confirmação, cancelamento ou reagendamento.

## Integrações e melhorias restantes

| Item | O que falta |
| --- | --- |
| Google Calendar A | Configurar OAuth e os quatro segredos; testar ligação, escolha de calendário e revogação com conta real. |
| Google Calendar B/C | Código e cron publicados; configurar OAuth e validar conta real. |
| Google Calendar D | Ler períodos ocupados e integrá-los na disponibilidade; etapa posterior. |
| Notificações | Resend implementado e cron ativo; configurar domínio/key e origem da app. Ativar por empresa e validar email real. |
| Analytics | Indicadores implementados e testados; publicar a atualização frontend na Vercel. |
| Testes adicionais | Realtime durante formulários e OAuth/SMTP reais; Safari/Firefox e dispositivos físicos ainda sem cobertura. |

Detalhes Google: [fase A](phase-12a.md) e [arquitetura](google-calendar-architecture.md).

## Publicar na Vercel

O `vercel.json` declara framework Vite, `npm run build`, saída `dist` e fallback
para `index.html`. Segue o [suporte oficial a Vite e rotas SPA](https://vercel.com/docs/frameworks/frontend/vite).

1. Importar ou selecionar o repositório/projeto correto e usar Node.js 24.
2. Preencher as duas variáveis públicas apenas se forem usados os percursos reais.
3. Publicar a revisão validada e registar o URL aqui/README.
4. Verificar navegação direta e reload; as páginas `/book/:slug`,
   `/booking/manage/:id#token=...` e `/dashboard/:businessId/reservations` precisam
   de dados/sessão de teste válidos para verificar também o resultado funcional.
5. Verificar no domínio os headers `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: no-referrer` e `X-Frame-Options: DENY`.

Migrations e Edge Functions são publicadas separadamente do frontend. Os testes
`db:test:cloud` e `db:test:concurrency` destinam-se ao projeto de desenvolvimento,
nunca a uma base com dados reais. O workflow CI não chama estes comandos.

## Validação desta revisão

- Vitest: 277 testes aprovados.
- Build TypeScript/Vite e lint: aprovados.
- Playwright: 70 testes aprovados numa execução geral, com APIs simuladas.
- SQL: 683 testes aprovados com as migrations novas em transações com rollback;
  36 testes da integração repetidos após aplicar o esquema.
- Deno: duas Edge Functions verificadas e publicadas; cron ativo. OAuth/Resend
  ainda não configurados na última verificação; nenhum email ou evento real enviado nos testes.

Comandos: `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`.
A primeira execução Playwright precisa de `npx playwright install chromium`.
O workflow segue o [guia CI do Playwright](https://playwright.dev/docs/ci).

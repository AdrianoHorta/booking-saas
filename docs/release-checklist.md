# Fecho do MVP e publicação

Revisão: 24 de setembro de 2026. Objetivo proposto: publicar o MVP de portefólio
com reservas e demonstração. Sincronização Google, notificações e analytics
continuam no roadmap; não são funcionalidades concluídas desta versão.

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
| Google Calendar B/C | Outbox, worker, retries e criação/alteração/cancelamento idempotentes de eventos. |
| Google Calendar D | Ler períodos ocupados e integrá-los na disponibilidade; etapa posterior. |
| Notificações | Escolher/configurar fornecedor e implementar envios e retries no servidor. SMTP do Auth não envia emails de reservas. |
| Analytics | Definir indicadores e implementar consultas/interface. O resumo atual não é um módulo de analytics. |
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

- Vitest: 255 testes aprovados.
- Build TypeScript/Vite e lint: aprovados.
- Playwright: os 64 cenários passaram entre a execução geral (62 aprovados) e
  repetições dirigidas após corrigir dois testes: navegação para terminar sessão
  e identificação dos bundles da demo. O relatório local contém a última execução
  dirigida, não uma nova execução geral dos 64 testes.
- SQL: 647 testes aprovados na etapa anterior; não repetidos nesta revisão,
  que não altera migrations nem regras da base de dados.
- Cloud, SMTP, OAuth e publicação: não verificados nesta revisão.

Comandos: `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`.
A primeira execução Playwright precisa de `npx playwright install chromium`.
O workflow segue o [guia CI do Playwright](https://playwright.dev/docs/ci).

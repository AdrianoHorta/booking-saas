# Google Calendar, emails e indicadores

## Google Calendar temporariamente desativado — 28 de setembro de 2026

Preparação para lançamento sem Google Calendar: o import/card na página da empresa
e o import/rota `/calendar/callback` estão comentados. A entrada da Edge Function
`google-calendar` responde 503, com a implementação original comentada. O canal
Calendar do `booking-worker` está comentado, preservando as tarefas pendentes e
mantendo o processamento de emails quando configurado.

Estas alterações só têm efeito nos ambientes publicados após deploy: Vercel para
o frontend e Supabase para as funções `google-calendar` e `booking-worker`.
Não foram removidos dados, migrations, credenciais ou a chave de cifra.

Para reativar, configurar/testar OAuth, descomentar os pontos acima, retirar a
resposta temporária 503 e publicar novamente frontend e ambas as Edge Functions.
Rever as tarefas Calendar pendentes antes de retomar o worker.
O estado descrito abaixo corresponde à implementação anterior à desativação.

O utilizador já publicou a aplicação na Vercel, configurou o Supabase e testou
os percursos existentes. Esta etapa acrescenta as integrações ao projeto existente;
os ajustes de design ficam para o fim.

Estado desta execução: migrations 025/026 aplicadas e `google-calendar` e
`booking-worker` publicadas em `booking-saas-dev` (`ztldgxngubtprderwssw`).
Tipos regenerados. Passaram 683 testes SQL com rollback, 277 testes Vitest e 70
testes de browser, build/lint e verificação Deno. Os 36 testes SQL novos foram
também repetidos no esquema aplicado. O segredo do worker foi gerado e instalado
nas Edge Functions e no Vault, sem exposição. O cron `booking-integrations-worker`
está ativo a cada minuto. Nenhum email ou evento real foi enviado pelos testes;
os secrets Google/Resend ainda não existiam na última verificação. Sem fornecedores
configurados, o worker responde 503 e não reclama tarefas. O frontend desta etapa
está no workspace, por publicar.

Diagnóstico localhost: `CALENDAR_ENCRYPTION_KEY` foi gerada e instalada, e
`CALENDAR_APP_ORIGINS` permite `http://localhost:5173` e `http://127.0.0.1:5173`.
Preflight confirmado com HTTP 200 para ambas; origens externas não autorizadas
mantêm HTTP 403. Faltam `GOOGLE_CALENDAR_CLIENT_ID` e `GOOGLE_CALENDAR_CLIENT_SECRET`.
Preservar a chave de cifra já instalada. Acrescentar a origem Vercel à lista quando
for testar nesse domínio, mantendo as origens locais necessárias.

## Funcionalidades

- Google Calendar: criar evento, atualizar a hora e remover após cancelamento.
  Escolher um calendário coloca as reservas futuras na fila de sincronização.
- Resend: emails de confirmação, reagendamento e cancelamento, com ligação privada
  da reserva. Ativação por empresa; desativado por defeito e sem emails retroativos.
- Indicadores: confirmadas, canceladas, valor e horas marcados; tabelas por dia e
  serviço, com intervalo até 366 dias no fuso da empresa. Valor marcado não é receita
  recebida: a aplicação não regista pagamentos.
- Página `/dashboard/:businessId/insights`, acessível pelo link **Indicadores e
  notificações**, para owner/admin. Employee não recebe estes agregados nem a fila.
- Últimas 30 operações por empresa com estado e erros sem contactos ou tokens.

## Como funciona

Os triggers inserem a intenção de envio na mesma transação da reserva. Um rollback
também remove essa intenção. A confirmação da reserva não depende de um pedido HTTP
ao Google ou Resend. O worker reclama até cinco tarefas por execução; cada tarefa
tem um lease de dois minutos e no máximo oito tentativas com espera crescente.
Tarefas da mesma reserva/canal não ultrapassam uma tarefa anterior em curso.

O payload de email mantém o destino e os dados do momento da alteração para repetir
exatamente o pedido. A chave de idempotência inclui UUID da reserva e ID do envio,
evitando colisões entre projetos. Resend guarda essas chaves durante 24 horas;
paramos retries incertos ao fim de 23 horas e mostramos **Requer atenção**.
Ver [idempotência Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).
Um envio concluído significa aceite pelo fornecedor, não chegada à caixa de entrada.
Nesta etapa não existem webhooks de entrega/bounce nem reenvio manual pela interface.

No Google, o ID do evento deriva do UUID da reserva; uma resposta perdida não leva
a gerar um segundo ID. Atualizações/remoções usam ETag e `If-Match`; a revisão
guardada no evento impede uma intenção anterior de substituir uma mais recente.
A ligação e o lease são verificados novamente antes da escrita remota. Os pedidos
têm timeout; falhas temporárias voltam à fila. Ver [versões de recursos Google](https://developers.google.com/workspace/calendar/api/guides/version-resources).

Os eventos incluem serviço, nome da empresa e referência, sem email, telefone,
participantes ou convites Google. A conta ligada tem de voltar a autorizar escrita
em eventos; o consentimento antigo de leitura não chega. Eventos não identificados
como pertencentes à reserva não são alterados. Uma eliminação manual no Google pode
exigir intervenção; não criamos eventos com novos IDs para esconder esse conflito.

Desligar, reassociar o profissional ou mudar de calendário invalida tarefas da
ligação anterior. **Os eventos já criados no calendário anterior são mantidos e
deixam de ser atualizados**; a interface explica este comportamento. Uma chamada
HTTP já em curso pode terminar durante a desconexão. Reautorizar e escolher o mesmo
calendário reconcilia reservas futuras e cancelamentos anteriormente enviados à
fila para esse destino. Não há transação distribuída com Google/Resend.

## Configurar Google

Seguir o [guia OAuth](phase-12a.md) com o domínio Vercel existente:

1. Ativar Calendar API e configurar cliente OAuth Web e utilizadores de teste.
2. Redirect exato: `https://TEU-DOMINIO/calendar/callback`.
3. Scopes: `openid`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   e `https://www.googleapis.com/auth/calendar.events`.
4. Guardar `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`,
   `CALENDAR_ENCRYPTION_KEY` e `CALENDAR_APP_ORIGINS` nos secrets Supabase.
5. Na app, ligar/voltar a autorizar e escolher o calendário após publicar a nova
   Edge Function `google-calendar`. Preservar a chave de cifra existente.

## Configurar Resend

1. Criar conta Resend e verificar um domínio de envio com os registos DNS indicados
   pelo fornecedor. Ver [domínios Resend](https://resend.com/docs/dashboard/domains/introduction).
2. Criar API key de envio. Guardar nos secrets da Edge Function:
   `RESEND_API_KEY`, `BOOKING_EMAIL_FROM` (ex. `Booking <reservas@teu-dominio.pt>`)
   e `BOOKING_APP_ORIGIN` (origem HTTPS exata da app, sem caminho).
3. Copiar `supabase/functions/booking-worker/.env.example` para `.env.worker.local`
   se preferires configurar pela CLI; preencher apenas localmente. Não guardar
   estes valores em `VITE_*` nem no repositório/conversa.
4. O worker/cron já foi configurado no projeto ligado. Depois de guardar os secrets
   Resend, ativar **Emails de reservas** na empresa.
   Só alterações posteriores à ativação geram emails. Desativar impede tarefas
   pendentes; um envio que já começou pode terminar.

Este Resend envia emails de reservas. SMTP do Supabase Auth continua separado.
Os emails são texto simples; nunca interpolam conteúdo do cliente em HTML.

## Publicar e agendar o worker

No projeto ligado, estes passos já foram executados. São referência para repetir
num projeto diferente; não voltar a gerar o segredo sem atualizar também o Vault.

Aplicar migrations 025/026 no projeto correto e publicar as duas Edge Functions.
O deploy Vercel atualiza apenas o frontend.

```powershell
$env:SUPABASE_TELEMETRY_DISABLED='1'
npx supabase db push --linked --dry-run --skip-vault
npx supabase db push --linked --skip-vault
npx supabase functions deploy google-calendar --project-ref TEU_PROJECT_REF
npx supabase functions deploy booking-worker --project-ref TEU_PROJECT_REF
```

1. Gerar um segredo aleatório de pelo menos 32 caracteres e guardar como
   `BOOKING_WORKER_SECRET` nos secrets Supabase. Não usar a chave pública nem uma
   sessão de utilizador. O endpoint valida este segredo antes de aceder à fila.
2. No Supabase Vault, guardar `booking_worker_secret` com o mesmo valor e
   `booking_worker_url` com `https://TEU_PROJECT_REF.supabase.co/functions/v1/booking-worker`.
3. Executar `supabase/ops/schedule-booking-worker.sql` no SQL Editor. Cria/atualiza
   apenas o job `booking-integrations-worker`, uma vez por minuto. O SQL guarda
   referências ao Vault, não o segredo no comando do cron. Ver [agendamento Supabase](https://supabase.com/docs/guides/functions/schedule-functions).
4. Acompanhar Cron/Edge Function logs e **Últimos envios** na app. Sem cron,
   os pedidos permanecem **Em espera** mesmo com OAuth/Resend configurados.

Para parar o processamento: `select cron.unschedule('booking-integrations-worker');`.
Para retomar, voltar a executar o script de agendamento. Não é necessário manter
o browser aberto. Reservas continuam a funcionar com o worker parado.

## Verificação real após configuração

1. Usar uma reserva de teste e um email a que tenhas acesso.
2. Confirmar: deve surgir um único evento Google e um email com a ligação privada.
3. Reagendar: o mesmo evento muda de hora; chega o email de reagendamento.
4. Cancelar: o evento é removido e chega o email de cancelamento.
5. Conferir os indicadores e o histórico de envios na empresa.
6. Testar revogação Google: deve aparecer **Requer atenção**, sem perder a reserva.
7. Não repetir manualmente emails com resultado incerto sem consultar o Resend.

Testes automatizados usam fornecedores simulados e fixtures SQL com rollback;
não enviam emails reais nem alteram calendários reais. A integração de períodos
ocupados do Google na disponibilidade (fase D) continua para uma etapa posterior.

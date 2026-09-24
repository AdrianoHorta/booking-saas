# Google Calendar — decisão de arquitetura

Estado: fase A implementada; configuração OAuth e teste real pendentes.
Ver [implementação e configuração](phase-12a.md). Jobs e sincronização de eventos
continuam planeados para as fases B–D.

## Ligação por colaborador

Cada employee pertence a uma empresa e pode ligar a sua conta Google e escolher
um calendário. A empresa pode ter vários colaboradores com calendários diferentes,
e colaboradores sem ligação. `business_members` representa autorização de acesso;
`employees` representará profissionais com agenda, incluindo quem não tem login.

Na Fase 6, prever `employees.business_id`, identidade estável, estado ativo e
`user_id` opcional associado a um membro da mesma empresa. Só o utilizador
autenticado associado ao employee pode autorizar a sua ligação. Owner/admin não
recebem tokens de colaboradores. Sem login associado, a ligação exige primeiro
um convite/associação autenticada, nunca apenas conhecer o employee_id.

## Contratos das próximas fases

| Fase | Decisão a preservar |
| --- | --- |
| 6 — Employees | Catálogo de profissionais separado dos papéis; relação employee/services com chaves que garantam o mesmo business_id. |
| 7 — Schedules | Horários recorrentes em hora local e timezone IANA; exceções, férias e bloqueios por employee. |
| 8 — Availability | Intervalos [início, fim), normalizados em UTC; fonte extensível de períodos ocupados por employee. |
| 9 — Booking | business_id, employee_id, service_id, início/fim e snapshots de duração/preço; validar o tenant de todas as referências no backend. |
| 11 — Gestão | Reagendar/cancelar preserva a identidade da reserva; versão da alteração para futura sincronização idempotente. |
| 12.x — Calendar | Ligação OAuth e sincronização assíncrona após a transação de booking. |

Disponibilidade = working hours − bookings ativas − bloqueios/férias − busy periods
externos. O motor inicial usa uma fonte externa vazia. Datas UTC e timezone local
devem permitir testes de mudança de hora; não calcular recorrências locais somando
sempre 24 horas. A criação de bookings revalida disponibilidade e impede
sobreposição na base de dados, mesmo quando chegam pedidos simultâneos.

## Etapas 12.x

A. OAuth/calendar connection por employee, estado visível, disconnect/reconnect.

B. SaaS → Google: depois de confirmar a booking, um job server-side cria o evento
no calendário ligado. Exemplo: “Corte de cabelo — João Silva”, início/fim da
reserva, cliente e serviço. Contacto/notas são opcionais e minimizados.

C. Reagendamento atualiza o evento associado; cancelamento remove/cancela esse
evento. Mudança de employee exige remover o evento antigo e criar no calendário
do novo employee, se ligado. Sem ligação, a reserva continua a funcionar.

D. Posteriormente, Google busy time → availability. Consultar intervalos ocupados
sem importar títulos ou participantes. Definir cache, renovação e política para
falhas: se a ligação ativa estiver desatualizada, não assumir silenciosamente
que o calendário está livre. Excluir/deduplicar eventos gerados pelo SaaS,
especialmente ao reagendar a própria booking; se FreeBusy não permitir distinguir
esses eventos, será necessário desenhar outra estratégia antes de implementar.

## Persistência futura e recuperação

Proposta, sem criar agora:

- `employee_calendar_connections`: id, business_id, employee_id, provider,
  calendar_id, status, timestamps e referência privada às credenciais.
- Associação booking/evento: booking_id, connection_id, calendar_id,
  provider_event_id, versão sincronizada, estado, última tentativa/erro.
- Outbox transacional: alteração de booking e intenção de sincronização no mesmo
  commit; worker com retries, backoff e idempotência. Falhar Google não perde a
  reserva. Jobs antigos não podem substituir versões mais recentes.

Índices únicos e referências compostas devem impedir associações entre tenants.
Não depender do frontend para executar jobs. Guardar o identificador de evento
permite reconciliação e evita criar duplicados após timeout. Ao reconnect, validar
conta/calendário antes de reutilizar associações antigas; disconnect para jobs e
explica o destino dos eventos existentes, sem os apagar silenciosamente.

## Segurança e OAuth

Design proposto: authorization code no backend/Supabase Edge Functions, callback
com state de uso único ligado à sessão, employee e tenant, redirects permitidos
e autorização novamente verificada no callback. Separar a ligação Calendar do
login no SaaS. Segredos, access tokens e refresh tokens ficam cifrados server-side,
fora de tabelas/colunas acessíveis ao React, logs e variáveis VITE_*.

Pedir acesso offline quando necessário; preservar o refresh token existente se a
resposta não trouxer um novo, renovar no servidor e tratar revogação/invalid_grant
como necessidade de reconnect. Disconnect revoga credenciais e elimina segredos.
Este fluxo segue a [documentação OAuth para servidores](https://developers.google.com/identity/protocols/oauth2/web-server).

Escolher scopes mínimos para o calendário e operações efetivamente suportados;
reavaliar scopes e consentimento ao adicionar busy time. Confirmar requisitos de
verificação antes do lançamento, segundo o [guia de consentimento e scopes](https://developers.google.com/workspace/guides/configure-oauth-consent).

## Critérios de aceitação futuros

Testar isolamento entre tenants/employees, consentimento recusado, refresh,
revogação, desconexão, duplicação de jobs, timeout após criação remota,
reagendamentos concorrentes, cancelamento, troca de employee/calendário e DST.
As fases A–C não incluem leitura de busy time; a fase D tem validação própria.

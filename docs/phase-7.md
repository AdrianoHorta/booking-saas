# Fase 7 — Horários por colaborador

Estado: implementação e validação automatizada concluídas. Modelo de dados, RLS,
API, hooks e interface disponíveis. Smoke test visual em browser real pendente.

## Horário semanal

`employee_working_hours` contém id, business_id, employee_id, weekday,
start_minute, end_minute, created_at e updated_at. Os dias seguem ISO:
segunda-feira = 1, domingo = 7. Os minutos representam hora local na timezone IANA
da empresa (`businesses.timezone`), não minutos UTC nem a timezone do browser.

Exemplo: segunda 09:00–12:00 corresponde a weekday=1, start_minute=540,
end_minute=720. Pode existir outro período 14:00–18:00 no mesmo dia, deixando a
pausa fora do horário. A ausência de linhas significa que não há horário de trabalho.

Todos os intervalos são [início, fim). São permitidos períodos consecutivos,
mas sobreposições e duplicados do mesmo colaborador/dia são rejeitados pela
constraint de exclusão GiST. O controlo está na base de dados, não num SELECT
seguido de INSERT no frontend. A migration instala btree_gist em extensions.
Ver [ranges e exclusões no PostgreSQL](https://www.postgresql.org/docs/15/rangetypes.html).

Início entre 0 e 1439, fim entre 1 e 1440, sempre fim > início. O valor 1440
representa a meia-noite no final do dia. Um turno 22:00–02:00 é guardado em duas
linhas: dia D [1320,1440) e dia seguinte [0,120), incluindo domingo → segunda.
A futura interface deve gravar as duas linhas atomicamente se apresentar um só turno.

## Bloqueios datados

`employee_blocked_periods` contém id, business_id, employee_id, starts_at,
ends_at, label, created_at e updated_at. Os extremos são timestamptz finitos,
com fim estritamente posterior ao início. Permite ausências de horas ou vários dias,
férias e feriados introduzidos por colaborador. Não importa feriados automaticamente.

A label é operacional e visível aos membros da empresa. Bloqueios sobrepostos
são permitidos: o motor de disponibilidade terá de calcular a união antes de
subtrair intervalos. Criar um bloqueio não cancela nem altera reservas existentes.
Reservas ainda não existem; a sua interação com bloqueios será definida nas fases 8–11.

## Segurança e integridade

As duas tabelas usam FK composta `(business_id, employee_id)` para employees,
RLS com private.has_business_role e grants por coluna. Owner/admin podem criar,
editar e remover intervalos da própria empresa. Employee consulta; outsider e
anon não têm acesso aos dados. Id, tenant, employee e timestamps não são editáveis.
updated_at usa o trigger comum. Remover um intervalo não apaga o colaborador,
o serviço ou qualquer futura reserva.

Há índices por empresa/colaborador para listagem e datas/dias. É permitido configurar
horários de colaboradores inativos; o futuro motor tem de exigir o estado ativo
da empresa, colaborador e serviço antes de disponibilizar vagas.

## Timezone e contrato com disponibilidade

Na fase 8, cada ocorrência semanal será expandida para uma data local e convertida
para instantes UTC usando a timezone da empresa. Não somar 24 horas UTC para obter
o dia local seguinte. Em mudanças de hora, o motor e a interface precisam de uma
política explícita para horas locais inexistentes ou ambíguas. A interface de
bloqueios já rejeita ambas e pede outra hora. A expansão semanal do motor ainda
não foi implementada.

Para um feriado de dia inteiro, calcular os dois limites de meia-noite local
separadamente: a duração pode ser 23 ou 25 horas. A futura UI deve mostrar o fuso
da empresa e converter entradas locais antes de enviar timestamptz.

Os horários semanais seguem a timezone atual da empresa; os bloqueios mantêm
instantes absolutos. Alterar a timezone futuramente requer rever esta diferença.
Não existem versões históricas do horário semanal neste incremento.

Contrato futuro: horários semanais − bookings ativas − união dos bloqueios − busy
time externo = disponibilidade. Google Calendar permanece apenas planeado, como
fonte adicional de intervalos ocupados por employee. Não existem chamadas Google.

## Validação

Migration `20260917001000_create_employee_schedules.sql` aplicada no projeto dev.
95 testes SQL novos com rollback: permissões para as duas tabelas, isolamento,
FK composta, limites, sobreposições, adjacência, pausas, turno noturno dividido,
domingo, dia completo, timestamps e bloqueio numa hora repetida com offsets distintos.
O teste de mudança de hora valida os instantes guardados, não a conversão na UI.

Suite completa: 286 testes SQL e 68 testes frontend/API aprovados. Build,
TypeScript strict, lint e diff check aprovados. Mantém-se o aviso existente
de bundle principal acima de 500 kB. Não há interface nova para validar visualmente.

## Segundo incremento — gestão de horários

Feature `src/features/schedules` com API tipada, hooks, schemas Zod, WeekForm,
BlockForm e SchedulePage. A rota protegida é
`/dashboard/:businessId/employees/:employeeId/schedule`, acessível por “Ver horário”
no card de colaborador. A página mostra sete dias, períodos e bloqueios ordenados,
no estilo editorial existente. Employee consulta; owner/admin gerem.

A semana é editada num modal, permitindo adicionar/remover períodos e guardar uma
semana vazia. A RPC `save_employee_working_hours` da migration 011 substitui todos
os períodos atomicamente com SECURITY INVOKER, grants e RLS existentes. Obtém lock
no colaborador para serializar substituições; a última gravação válida prevalece.
Constraints continuam a impedir sobreposição; falhas restauram a semana anterior.
O utilizador divide explicitamente turnos noturnos em duas linhas no mesmo formulário.

Bloqueios têm criação, edição e remoção com confirmação. As queries e mutations
filtram business_id e employee_id, além do id nas alterações individuais. Deletes
exigem uma linha devolvida, evitando reportar sucesso sem remover nada. Não há
alteração das regras de DELETE de colaboradores ou serviços.

O cache usa `['schedule', businessId, employeeId]`, com invalidação após mutations
e cancelamento de leituras por AbortSignal. Mudança de colaborador/empresa desmonta
o editor. Erros preservam valores; botões e Escape não fecham modais durante gravação.

As entradas datetime-local são interpretadas na timezone da empresa, sem usar o
fuso do computador. Usa-se `@js-temporal/polyfill` com disambiguation='reject' para
conversão e validação. Horas inexistentes/ambíguas exigem escolher outra hora;
não há seleção entre primeira/segunda ocorrência neste incremento. Isto aplica-se
também a edições de bloqueios inseridos externamente nessas horas. Ver a
[documentação Temporal](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)
e o [polyfill utilizado](https://github.com/js-temporal/temporal-polyfill).

O formulário tem precisão de minuto. A listagem inclui bloqueios passados e futuros;
filtros/paginação não fazem parte deste incremento. Não há importação de feriados.

## Validação do segundo incremento

- 26 testes SQL novos da RPC; 312 testes cloud no total, com rollback das fixtures.
- Suite frontend/API completa: 97 testes aprovados; build, TypeScript strict,
  lint e diff check aprovados. Mantém-se o aviso existente de bundle > 500 kB.
- Testes de conversão para Lisboa no inverno/verão e fuso com offset fracionário;
  datas inválidas, horas inexistentes/ambíguas e dias inteiros de 23/25 horas.
- Testes React com hooks reais e API simulada: semana, sobreposições, erros,
  bloqueios, confirmação de remoção, proteção durante pedidos e permissões employee.
- Testes API verificam filtros tenant/employee, payload da RPC e propagação de erros.
- Tipos regenerados da cloud; migration 011 aplicada no projeto dev.

Validação de interface em jsdom, sem percurso browser real → Supabase. Smoke test
pendente: abrir “Ver horário”, guardar semana com pausa, criar/editar/remover um
bloqueio, testar teclado/mobile e repetir num computador com timezone diferente.
Nenhum deploy Vercel foi realizado neste incremento.

## Próxima fase

Fase 8 — motor de disponibilidade, combinando horários, bloqueios e duração de
serviço. Ainda não implementado. Google Calendar continua apenas planeado.

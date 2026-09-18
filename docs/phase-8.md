# Fase 8 — Disponibilidade

Estado: implementação e validação automatizada concluídas para consulta privada
de disponibilidade, com horários e bloqueios reais. Smoke test num browser real
pendente. Criação de bookings pertence à Fase 9.

`calculateSlots` recebe um intervalo de trabalho e intervalos ocupados em instantes
UTC (epoch milissegundos), duração do serviço e passo entre possíveis inícios.
A grelha começa no início do período. Só devolve vagas inteiramente contidas no
horário, sem interseção com intervalos ocupados. Limites usam [início, fim).
Bloqueios sobrepostos/duplicados têm o mesmo efeito que a sua união.

Esta função isolada não consulta Supabase nem garante uma reserva. Os módulos
seguintes acrescentam expansão semanal, contexto autorizado e filtro de passado.

## Expansão e motor diário

`expandWorkingHours` usa Temporal para interpretar uma data ISO no fuso da empresa.
Dias seguem ISO (segunda=1); 1440 representa a meia-noite local seguinte. Une
períodos consecutivos/sobrepostos antes de converter os limites para UTC, sem
alterar os dados recebidos. Pausas continuam a separar turnos.

Limites de turno inexistentes ou ambíguos numa mudança de hora produzem erro
explícito. Quando a transição fica dentro do turno, a duração segue o tempo real:
dias inteiros podem ter 23 ou 25 horas. Instantes repetidos na mesma hora local
continuam distintos e a interface mostra o offset UTC para os distinguir.

`calculateDailyAvailability` junta intervalos ocupados de três fontes: bloqueios,
reservas e busy time externo. Aceita serviços de 1 minuto a 31 dias; o limite evita
expansões ilimitadas para durações anormais e é verificado também no backend.
Usa o intervalo entre inícios da empresa (5–120 minutos, múltiplos de 5).

A grelha começa no início de cada turno contínuo do dia solicitado. Turnos que
vêm do dia anterior iniciam a grelha à meia-noite do dia solicitado. Dias seguintes
só são expandidos enquanto o turno continua sem pausas; isto permite terminar um
serviço depois da meia-noite, incluindo domingo → segunda. Só são devolvidas
vagas cujo início pertence à data pedida. Bloqueios do dia seguinte também contam
quando uma vaga atravessa a meia-noite. Duração e passo são minutos de tempo real,
não uma soma de horas locais durante transições DST.

Inícios anteriores à hora de referência são removidos sem deslocar a grelha.
Um início exatamente nessa hora ainda pode aparecer; a leitura não garante que
continue livre no momento de uma futura confirmação.

## Leitura privada no Supabase

Migration `20260917001200_add_availability_context.sql`, aplicada no projeto dev.
A RPC `get_availability_context` é STABLE e SECURITY INVOKER: lê um snapshot por
consulta, sujeito a grants, RLS e private.has_business_role. Owner, admin e employee
podem consultar a própria empresa; anon e utilizadores externos não podem executar
a consulta com acesso aos dados. Employee e service são procurados pelo par tenant/id.

A função devolve timezone, intervalo de marcação, duração, estados ativos,
associação employee/service, horário semanal, bloqueios relevantes e hora do servidor.
Não devolve labels dos bloqueios. A janela dos bloqueios inclui a duração do serviço
e margem de dias locais para a continuação do turno. A agregação JSON evita truncar
bloqueios pela paginação padrão de SELECT do PostgREST.

O frontend valida a resposta antes de calcular. Empresa/serviço/employee inativo
ou associação inexistente produzem zero vagas e uma razão visível. Uma falha de
permissão, rede, validação ou timezone produz erro; não é convertida numa agenda livre.
O cálculo de vagas usa a hora enviada pelo servidor, não o relógio do computador.

Na conclusão original desta fase ainda não existiam bookings. O primeiro incremento
da [Fase 9](phase-9.md) acrescentou a leitura privada dos intervalos de reservas
confirmadas, que já são descontados. Google continua sem ligação e fornece lista
vazia. A função de confirmação ainda terá de revalidar disponibilidade no backend;
nunca confiar numa vaga calculada no React para autorizar uma reserva. A base de
bookings já tem constraint de exclusão, mas ainda não há criação pública.

## Interface e cache

Rota protegida `/dashboard/:businessId/availability`, acessível por “Consultar
disponibilidade” na página da empresa. Seleção de serviço ativo, colaborador ativo
associado e data. Mostra vagas no fuso da empresa, limites com offset e data de fim
quando termina no dia seguinte. Não tem botão para reservar.

Estados de carregamento, erro/repetição, sem vagas, empresa inativa e ausência de
opções são explícitos. Trocar serviço limpa o colaborador; trocar tenant desmonta
o estado. Query key: `['availability', businessId, employeeId, serviceId, date]`,
com AbortSignal e sem reutilização de resultados de outra seleção.

Atualização a cada 30 segundos, ao voltar à janela ou premir “Atualizar”. Mutations
de serviços, colaboradores, associações, horários e bloqueios invalidam as consultas
afetadas. Entre leituras, o resultado filtra inícios expirados usando a hora de
referência do servidor mais tempo decorrido; não garante uma reserva em concorrência.

## Validação

- 144 testes frontend/API no total, incluindo 47 testes de disponibilidade.
- 48 testes SQL novos da leitura privada; suite cloud total de 360 testes aprovados,
  com rollback das fixtures.
- Build, TypeScript strict, lint e diff check aprovados. Persiste o aviso anterior
  de chunk principal acima de 500 kB.
- Testes de horários adjacentes, pausas, bloqueios sobrepostos, três fontes de busy
  time, passado, meia-noite, DST, estados ativos, permissões e resposta obsoleta
  depois de trocar a seleção. Testes React usam jsdom e API simulada.

Smoke test browser → Supabase por executar: criar um serviço de 30 min, associar a
um colaborador ativo, configurar dois períodos com pausa e consultar uma data
futura. Adicionar um bloqueio e voltar à consulta; desativar/repor o colaborador;
testar employee e empresa diferente. Verificar mobile e um browser com outro fuso.
Nenhum deploy Vercel realizado neste incremento.

## Próximo passo

Fase 9 — fluxo público de reservas: contrato público mínimo, clientes/bookings,
gravação server-side e proteção transacional contra sobreposição. Ainda não iniciada.

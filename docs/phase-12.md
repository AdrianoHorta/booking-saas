# Fase 12 — Atualização automática das reservas

## OBJECTIVE

Atualizar a área privada quando um cliente ou membro da equipa cria, cancela ou
reagenda uma reserva, sem exigir um refresh manual.

## CONCEPTS

Uma subscrição recebe eventos enquanto a página está aberta. A cache guarda os
resultados das consultas. Invalidar a cache marca esses resultados como antigos
e volta a consultar os que estão em uso. O evento não substitui a autorização.

## ARCHITECTURE

`bookings → trigger → booking_revisions → Supabase Realtime → invalidateQueries`

`booking_revisions` contém apenas `business_id` e `revision`. O trigger incrementa
a revisão na mesma transação de criação ou alteração da reserva. Um rollback
também desfaz a revisão. Só membros da empresa podem ler o aviso, através de RLS;
ninguém no browser pode escrever nesta tabela. As consultas seguintes continuam
a aplicar as permissões de owner/admin/employee às reservas e contactos.

Não publicamos a tabela de reservas para obter estes avisos. O colaborador pode
assim atualizar a disponibilidade sem receber contactos das reservas de colegas.
Implementação baseada na [documentação Supabase de Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## IMPLEMENTATION PLAN

1. Migration da tabela, política, trigger e publicação.
2. Subscrição partilhada pelas páginas privadas de uma empresa.
3. Atualização das consultas, reconexão, limpeza e fallback periódico.
4. Testes da cache e das permissões SQL, build e regressão de concorrência.

## WHAT WE BUILT

Reservas, resumo, disponibilidade privada e vagas de reagendamento passam a
reagir a alterações de reservas. A atualização em segundo plano da lista não
desmonta os cards nem fecha o formulário aberto. Removida a indicação redundante
do fuso horário no resumo; os cálculos continuam a usar o fuso da empresa.

## HOW IT WORKS

O layout só inicia a subscrição depois de confirmar acesso à empresa. Escuta
INSERT e UPDATE da revisão, filtrados por empresa. Eventos num intervalo de
200 ms originam uma só invalidação. As chaves de consultas restringem a atualização
à empresa atual e, quando incluída na chave, à conta atual.

Cada ligação ou reconexão provoca uma consulta: eventos perdidos durante uma
interrupção não são tratados como um histórico recuperável. Enquanto a página
está visível, há também uma atualização a cada 60 segundos. Voltar à página ou
recuperar a ligação à internet desencadeia nova consulta. A atualização periódica
continua mesmo se o canal falhar, desde que o acesso HTTP esteja disponível.

Ao sair ou mudar de empresa/conta, o canal, timers e listeners são removidos.
Callbacks antigos são ignorados. O QueryProvider existente separa a cache por conta.

## FILES CHANGED

- `supabase/migrations/20260922002300_booking_realtime.sql`: sinal mínimo e RLS.
- `supabase/tests/database/booking_realtime.test.sql`: 13 verificações SQL.
- `src/features/reservations/use-booking-realtime.ts`: eventos e recuperação.
- `src/features/reservations/use-booking-realtime.test.tsx`: 5 testes da subscrição.
- `src/app/layouts/business-layout.tsx` e `src/app/router.tsx`: ciclo de vida comum.
- `src/features/reservations/reservations-page.tsx`: preserva cards durante refresh.
- `src/features/reservations/reservation-summary.tsx`: usa a atualização partilhada.
- `src/lib/supabase/database.types.ts`: tipos regenerados.
- `README.md` e este documento: estado e percurso de validação.

## IMPORTANT CODE

`ON CONFLICT ... revision + 1` mantém uma única linha por empresa. Não guarda
um histórico de eventos nem dados pessoais. `isBookingQuery` escolhe as consultas
afetadas. `invalidateQueries` volta a pedir os dados ao servidor. `disposed`
impede que callbacks tardios de uma subscrição removida tenham efeito.

## GOOD PRACTICES USED

RLS, ausência de dados pessoais nos avisos, trigger transacional com search_path
fixo, privilégio mínimo, agrupamento de eventos, recuperação por nova leitura,
limpeza de recursos e testes de isolamento e rollback.

## THINGS TO TEST

Validação automática: 623 testes SQL e 235 testes frontend/API aprovados
(suite geral e repetição dirigida após corrigir o ambiente do novo teste).
Build e lint aprovados. O teste concorrente confirmou um vencedor por vaga,
retry seguro e preservação da reserva quando o reagendamento perde a disputa.

1. Abrir as reservas de Miguel numa janela com sessão de equipa.
2. Noutra janela, criar uma reserva pública para Miguel no período selecionado.
   Deve aparecer sem carregar em Atualizar.
3. Cancelar pela ligação privada dentro do prazo. Confirmar o novo estado na
   equipa e a vaga livre na consulta de disponibilidade privada.
4. Reagendar pela equipa noutra janela. Confirmar nova data e resumo atualizado.
5. Manter o formulário de reagendamento aberto durante outra criação de reserva:
   a janela deve permanecer aberta e atualizar as vagas.
6. Desligar a rede, alterar uma reserva noutro dispositivo e voltar a ligar.
   Verificar a recuperação dos dados.
7. Trocar de empresa e terminar sessão: nenhum dado de outra conta deve aparecer.

A migration foi aplicada no projeto de desenvolvimento. A verificação visual de
duas janelas e da entrega WebSocket real fica pendente; os testes do hook simulam
os eventos e os testes SQL validam o lado da base de dados. Sem deploy nesta etapa.

Âmbito: a subscrição serve a área privada. A página pública e a ligação privada
do cliente não subscrevem avisos de empresa. Alterações de serviços, horários ou
membros não geram estes avisos. Eliminações administrativas diretas de reservas
não geram revisão; os percursos da aplicação preservam o histórico por cancelamento.
Uma revisão por empresa serializa brevemente alterações simultâneas nessa empresa;
avaliar Broadcast se o volume justificar outra arquitetura.

## WHAT I LEARNED

Realtime é uma forma de reduzir o atraso do ecrã; os dados e as permissões
continuam a ser responsabilidade do servidor. Eventos podem perder-se, pelo
que a aplicação precisa de voltar a consultar após reconexões.

## NEXT STEP

Validar manualmente o percurso completo para a demonstração. Depois, avançar
para a fase 12.x A: ligação Google Calendar por colaborador, conforme o design existente.

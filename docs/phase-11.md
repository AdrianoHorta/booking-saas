# Fase 11 — Gestão de reservas: cancelamento

## OBJECTIVE

Gerir reservas com cancelamento privado, cancelamento pelo cliente através de
ligação segura, prazo configurável e reagendamento transacional. As secções iniciais
descrevem o primeiro incremento; o segundo, abaixo, acrescenta prazos e reagendamento.

## CONCEPTS

Transições de estado, autorização no servidor, registo de autoria, transações e
idempotência. Cancelar significa alterar o estado, não eliminar a reserva.

## ARCHITECTURE

O cartão de reserva confirmada inclui CancelReservation. O adaptador chama a RPC
cancel_booking, que verifica membership e profissional associado, bloqueia a linha
da reserva e altera o estado. A disponibilidade e a exclusão de sobreposições já
consideram apenas reservas confirmed; não foi necessário reescrever o motor.

## IMPLEMENTATION PLAN

Migration 020 com auditoria e RPC, ação com confirmação no cartão, atualização de
cache e testes de permissões, retries, histórico e libertação de vagas.

## WHAT WE BUILT

Owner/admin podem cancelar reservas da empresa. Employee só pode cancelar reservas
do profissional associado à sua conta. Anon, outsiders e employees sem associação
não podem cancelar. Reservas iniciadas são rejeitadas pelo relógio do servidor.
A publicação ou atividade da empresa não bloqueia a gestão das reservas existentes.

## HOW IT WORKS

A função procura a reserva pelo par business_id/id e obtém um lock FOR UPDATE.
Verifica as permissões antes de devolver informação, mesmo num pedido repetido.
Para uma reserva confirmed, exige starts_at > clock_timestamp() e grava status,
cancelled_at e cancelled_by na mesma transação. Se já estiver cancelled, devolve
o resultado guardado sem alterar a autoria/data, mesmo depois da hora marcada.

O registo cancelled_by referencia auth.users com ON DELETE SET NULL: eliminar
administrativamente uma conta não elimina o histórico da reserva. Cancelamentos
antigos feitos fora desta RPC podem não ter autoria/data preenchidas.

O cartão pede confirmação e informa que não é enviada notificação automática ao
cliente. O botão bloqueia durante a escrita. Após sucesso, são invalidadas as
consultas de reservas, resumo, disponibilidade privada e vagas públicas no cliente
atual. Outros browsers precisam de atualizar; Realtime continua para outra etapa.
Não existe atualização otimista nem reativação automática de reservas canceladas.

## FILES CHANGED

- Migration 020: colunas de auditoria e função cancel_booking.
- cancel_booking.test.sql: autorização, histórico, retries e disponibilidade.
- reservations-api.ts: adaptador de cancelamento, validação e mensagens de erro.
- cancel-reservation.tsx e respetivo teste: confirmação, gravação e atualização.
- reservations-page.tsx: integração no cartão compacto existente.
- database.types.ts: tipos regenerados do esquema aplicado.
- README e este guia: estado e roteiro de teste.

## IMPORTANT CODE

`FOR UPDATE` serializa alterações à mesma reserva. Uma segunda tentativa espera
pela primeira e pode devolver o estado já cancelado. Os privilégios de UPDATE
direto em bookings continuam fechados para os clientes.

`starts_at <= clock_timestamp()` rejeita reservas iniciadas. O botão também usa
a hora de montagem do cartão para esconder ações passadas, mas essa verificação
visual não substitui o relógio nem a autorização do servidor.

## GOOD PRACTICES USED

Histórico preservado, resposta mínima sem contactos, autorização por empresa e
profissional, registo de autoria, escrita transacional e pedidos repetíveis.
Confirmação explícita na UI e atualização das leituras dependentes após sucesso.

## THINGS TO TEST

Validação automatizada: 213 testes frontend/API (4 novos) e 570 testes SQL
(16 novos) aprovados. Build e lint aprovados. Migration 020 aplicada no projeto
de desenvolvimento e tipos regenerados.

1. Criar uma reserva futura de teste para o Miguel.
2. Entrar como Miguel e abrir As minhas reservas no período correto.
3. Clicar Cancelar reserva e depois Manter reserva: nada deve mudar.
4. Repetir e confirmar: a reserva passa a Cancelada, ou desaparece se o filtro for Confirmadas.
5. Consultar a disponibilidade pública: a vaga deve voltar a estar livre.
6. Consultar o resumo: as contagens confirmadas devem ser atualizadas.
7. Verificar que outro colaborador não consegue cancelar a reserva do Miguel.
8. Verificar que reservas iniciadas não podem ser canceladas e que uma falha de
   ligação permite repetir o mesmo cancelamento sem duplicar efeitos.

Não foi executado o percurso manual no browser. Os testes SQL usam fixtures com
rollback; nenhuma reserva real foi cancelada nesta implementação. Não houve deploy.

## WHAT I LEARNED

Uma transição de estado deve ter regras explícitas. O relógio do browser serve
para apresentação; o servidor decide se a operação ainda é permitida. Repetir uma
ação pode ser seguro sem criar um novo identificador, quando atua sobre a mesma
reserva e mantém o mesmo estado final. Cancelamento não equivale a apagar história.

## NEXT STEP

Validar o percurso no browser. O reagendamento está implementado no segundo
incremento, descrito abaixo. Realtime e notificações ficam para as próximas fases.

## Segundo incremento — prazo, ligação privada e reagendamento

### OBJECTIVE

Permitir ao cliente cancelar sem login, configurar a antecedência mínima por
empresa e permitir à equipa alterar a data/hora sem perder a marcação original.

### CONCEPTS

Tokens de autorização assinados, políticas guardadas na reserva, comparação do
estado esperado antes da escrita, locks e operações idempotentes.

### ARCHITECTURE

Migration 021 acrescenta cancellation_notice_hours às empresas e às reservas,
com default 12. Um trigger guarda na reserva o prazo da empresa no momento da
criação. Alterar a configuração afeta reservas novas; as existentes mantêm as
condições originais. Reservas anteriores à migration recebem o default de 12 horas.

As RPCs públicas get_customer_booking/cancel_customer_booking exigem UUID e token.
O token é HMAC-SHA256 do identificador com segredo aleatório de 32 bytes guardado
numa tabela privada, sem permissões de leitura para anon/authenticated. Não é
guardado nas tabelas públicas nem é possível derivá-lo apenas pela referência.
O mesmo pedido de confirmação devolve o mesmo token em retries.

A implementação anterior de confirmação foi movida para private.confirm_booking_core,
sem EXECUTE dos clientes. O wrapper público reutiliza a transação e acrescenta o
token, prazo e data limite ao recibo. A consulta pública do catálogo também informa
o prazo antes da confirmação.

Migration 022 acrescenta get_reschedule_slots e reschedule_booking para a equipa.
Utiliza os horários e regras de DST existentes, mas desconta apenas outras reservas:
uma nova vaga pode sobrepor-se ao intervalo da própria reserva que está a mudar.

### IMPLEMENTATION PLAN

Criar configuração e snapshot da política, token privado e endpoints mínimos;
reutilizar o motor para vagas de reagendamento; integrar páginas e definição;
validar regressões, limites de tempo, permissões e concorrência real.

### WHAT WE BUILT / HOW IT WORKS

**Prazo:** owner/admin definem de 0 a 720 horas inteiras em Reservas públicas →
Prazo de cancelamento. O valor inicial é 12. O servidor aceita até ao limite
inclusivo, mas nunca depois do início. A regra aplica-se ao cliente e à equipa,
sem bypass administrativo. Isso substitui a regra anterior que só verificava
se a reserva tinha começado. O relógio do servidor decide; a UI apenas orienta.

**Cliente:** o recibo mostra a ligação `/booking/manage/:id#token=...`. O segredo
fica no fragmento, não no caminho/query enviados ao servidor que serve a página.
A página envia-o no corpo da RPC ao Supabase. Quem possui a ligação pode consultar
os dados mínimos e cancelar dentro do prazo. Não devolvemos nome/email/telefone
do cliente. Abrir a ligação não cancela: a UI exige uma confirmação explícita.
Publicação fechada não impede gerir uma reserva já existente através do token.
O cancelamento regista cancelled_by_customer=true; os contactos e a história
são preservados. Repetir um cancelamento válido já concluído continua seguro.

Sem email automático, o cliente deve guardar a ligação no recibo. Reservas antigas
não recebem a ligação retroativamente por email. Um retry válido da confirmação
original pode recuperar o recibo com token, se o pedido ainda estiver disponível.
Não existe nesta etapa reemissão/revogação individual de tokens pela interface.

**Reagendamento:** disponível aos gestores da empresa ou ao profissional associado
à reserva. Muda apenas data/hora; serviço, profissional, duração, preço e política
de cancelamento são preservados. O prazo de cancelamento passa a contar a partir
do novo início. Reagendar uma reserva confirmada é permitido antes do seu início;
não usa o prazo de cancelamento como prazo de reagendamento. Não há reagendamento
público pelo cliente nesta etapa.

A RPC bloqueia empresa/profissional/serviço e horários segundo a ordem usada pela
confirmação, depois a reserva. Confirma que o início atual corresponde ao
expected_start. Um pedido antigo não pode sobrescrever uma alteração posterior.
Se o início já corresponder ao destino pedido, a operação é um retry sem nova
escrita. O UPDATE mantém a exclusão GiST: se a vaga estiver ocupada, o UPDATE
falha e a reserva original permanece intacta. rescheduled_at/by registam a última
alteração; não existe ainda uma tabela de histórico de todos os reagendamentos.

A janela de edição mostra a data atual, vagas e confirmação. Em erro definitivo,
permite voltar a selecionar; em resultado incerto, bloqueia alterações ao pedido
e oferece Verificar alteração com os mesmos dados. Atualiza reservas, resumo e
disponibilidade após sucesso. Noutras abas, atualizar continua necessário.

### FILES CHANGED

- Migrations 021/022: prazo, token, endpoints públicos e reagendamento.
- customer_cancellation_reschedule.test.sql: testes SQL da nova funcionalidade.
- public_booking_catalog.test.sql: contrato atualizado com o prazo.
- booking-api.ts / public-booking-page.tsx: prazo na revisão e token no recibo.
- customer-booking-api.ts / customer-booking-page.tsx: consulta/cancelamento sem login.
- cancellation-settings.tsx e integração em public-booking-settings.tsx: configuração.
- business-api.ts / business.types.ts: leitura da definição da empresa.
- reschedule-api.ts / reschedule-reservation.tsx: vagas e alteração na área privada.
- reservations-api.ts / reservations-page.tsx / cancel-reservation.tsx: política e ações.
- router.tsx / public-layout.tsx: rota pública de gestão e título.
- database.types.ts: tipos regenerados.
- Testes frontend ao lado dos componentes/adaptadores e script de concorrência ampliado.

### IMPORTANT CODE

`now_value > starts_at - cancellation_notice_hours * interval '1 hour'` rejeita
cancelamento após o limite. A política copiada na reserva impede alterações
retroativas. `expected_start` deteta alterações concorrentes no reagendamento.
A assinatura HMAC autoriza a ligação sem expor a chave privada nem aceitar apenas
o identificador público como credencial.

### GOOD PRACTICES USED

Segredo apenas no servidor, token no fragmento do URL, leitura pública mínima,
confirmação explícita, verificação temporal no servidor, regras transacionais,
preservação dos valores contratados e testes concorrentes com fixtures isoladas.
Não foram criados convites, envios de email ou cancelamentos de reservas reais.

### THINGS TO TEST

Validação: 610 testes SQL e 230 testes frontend/API aprovados, lint e build aprovados.
O script de concorrência passou: uma confirmação por vaga; retries sem duplicação;
dois reagendamentos para uma vaga resultam num vencedor e num horário original
preservado; repetir o vencedor é seguro. Fixtures sintéticas removidas no fim.
Migrations aplicadas no projeto de desenvolvimento. Sem deploy nesta etapa.
Validação manual completa no browser continua pendente.

1. Como owner/admin, confirmar default 12 e guardar 24 horas na empresa.
2. Criar nova reserva pública para mais de 24h no futuro: a revisão deve mostrar
   24h e o recibo deve incluir a ligação privada.
3. Guardar/abrir essa ligação sem login e confirmar o cancelamento. Verificar a
   vaga novamente livre e estado Cancelada na área privada.
4. Numa reserva com início dentro do prazo, verificar que cliente e equipa não
   conseguem cancelar. Alterar o relógio local não deve ultrapassar a regra SQL.
5. Alterar a política e confirmar que a reserva anterior mantém o valor original.
6. Reagendar uma reserva futura para nova vaga. Confirmar que a referência, preço
   e duração se mantêm e que a ligação do cliente mostra a nova data e limite.
7. Disputar a mesma vaga em duas abas: a operação perdedora preserva o horário.
8. Testar repetição após falha de ligação e impedir edição com resultado incerto.

### WHAT I LEARNED / NEXT STEP

Possuir uma ligação privada pode autorizar uma ação específica sem criar uma conta.
As políticas precisam de ter um âmbito temporal claro. Reagendar deve ser uma
alteração atómica, não cancelar e criar outra reserva. O próximo passo é validar
estes percursos manualmente e avançar para a atualização em tempo real da fase 12.

# Fase 10 — Consulta privada e resumo de reservas

## OBJECTIVE

Mostrar as marcações na área privada: As minhas reservas para employee e Reservas
da empresa para owner/admin. Primeiro incremento do dashboard; sem alteração ou
cancelamento nesta etapa.

## CONCEPTS

RLS filtra dados no servidor, enquanto a UI apresenta o resultado autorizado.
Datas escolhidas são dias locais da empresa e precisam de conversão para instantes
antes da consulta. Paginação limita o volume de dados; chaves de cache incluem
utilizador, empresa e filtros para não misturar respostas.

## ARCHITECTURE

Rota protegida `/dashboard/:businessId/reservations`. A página valida o acesso à
empresa com useBusiness. Employees consultam também o profissional associado à sua
conta. getReservations consulta bookings com os contactos permitidos de customers,
sem SECURITY DEFINER novo e sem novas permissões. As policies existentes impõem a
agenda do profissional associado para employee e a empresa para owner/admin.

## IMPLEMENTATION PLAN

Reutilizar as policies de reservas, criar a consulta com filtros e paginação,
integrar página/ligação, testar datas e estados da interface e repetir testes SQL
de autorização. Não foi necessária migration.

## WHAT WE BUILT

Lista de reservas com serviço, profissional, cliente, email, telefone quando
preenchido, início/fim, duração, preço, estado e referência. Filtros Desde, Até e
Estado. Por defeito, hoje até daqui a seis dias no fuso da empresa, todos os estados.
Botão Atualizar reservas e páginas de 25 resultados. Não existe subscrição Realtime.

## HOW IT WORKS

A consulta filtra business_id e intervalos que se sobrepõem ao período escolhido:
starts_at < fim exclusivo e ends_at > início. Uma reserva iniciada na véspera mas
ainda em curso aparece. O fim exclusivo é a meia-noite local após a data Até.
Temporal calcula esses limites respeitando dias de 23 ou 25 horas na mudança da hora.
O intervalo selecionado pode ter 1 a 31 dias.

Ordenamos por starts_at e id para desempatar inícios iguais. Pedimos 26 registos,
mostramos 25 e usamos o extra para saber se há página seguinte. Novas reservas entre
consultas podem deslocar resultados na paginação por offset; atualizar volta a
consultar a página atual. Alterar um filtro regressa à primeira página.

Dados de serviço, profissional, preço e duração vêm dos snapshots da reserva.
Contactos vêm do cliente autorizado pela RLS. Se os contactos não vierem na resposta,
a reserva continua visível com indicação de contactos indisponíveis.

Sem perfil profissional ligado, o employee recebe uma explicação para pedir a
associação ao gestor. Não estar ativo não apaga as reservas históricas: a consulta
continua disponível aos membros autorizados de empresas/profissionais inativos.

## FILES CHANGED

- reservations-api.ts: valida filtros, converte datas, consulta reservas e perfil próprio.
- reservations-page.tsx: carregamento, erro, filtros, lista e paginação.
- Testes ao lado destes ficheiros: limites DST, queries, interação e respostas antigas.
- router.tsx: rota protegida carregada com lazy.
- business-page.tsx: ligação com texto adequado ao papel.
- README e documentação: estado e roteiro atualizado.

## IMPORTANT CODE

`.eq('business_id', ...)` restringe a consulta à empresa selecionada. Isto ajuda a
construir o pedido, mas a segurança é assegurada pelas policies: remover o filtro
no browser não permite ultrapassar a RLS.

`['reservations', userId, filters]` identifica a consulta. Não reutilizamos a lista
anterior durante a mudança de filtros; uma resposta atrasada fica na sua própria
entrada de cache. O AbortSignal permite cancelar pedidos que deixaram de ser úteis.

## GOOD PRACTICES USED

Campos explícitos, leitura sujeita a RLS, contactos privados fora de URLs/logs,
fuso horário visível, limites locais corretos, paginação, distinção entre erro e
ausência de reservas e reutilização dos componentes visuais existentes.

## THINGS TO TEST

Validação: 199 testes frontend/API aprovados (15 novos), build e lint aprovados.
Reexecutados os 65 testes SQL de booking_foundation, aprovados com rollback.
A última suite SQL completa mantém 554 testes. Percurso manual no browser pendente.

1. Criar uma marcação para o Miguel na página pública, ou usar a já existente.
2. Entrar com a conta do Miguel, abrir a empresa e As minhas reservas.
3. Se necessário, ajustar Desde e Até para incluir o dia marcado. Clicar Atualizar reservas.
4. Verificar serviço, cliente, horário no fuso da empresa e referência do recibo.
5. Entrar como owner/admin: Ver reservas da empresa deve mostrar também as de outros profissionais.
6. Com outro employee associado a outro profissional, verificar que a reserva do Miguel não aparece.
7. Testar conta sem associação: mensagem de orientação, sem mostrar dados de outros profissionais.
8. Experimentar estado Canceladas, período sem reservas, datas inválidas e falha de ligação.

## WHAT I LEARNED

Consultar reservas é diferente de consultar vagas. Uma agenda privada precisa de
contactos e permissões por profissional. Um dia local não equivale sempre a 24 horas.
Snapshots preservam o que foi reservado mesmo após alterações no catálogo.

## NEXT STEP

Validar o ciclo completo no browser. Depois acrescentar gestão/cancelamento de
reservas com revalidação no servidor. Realtime, notificações e integração Calendar
continuam pendentes.

## Resumo na página da empresa

A página `/dashboard/:businessId` inclui contagens de reservas confirmadas de hoje
e de sete dias de calendário, incluindo hoje. Conta pela data de início, no fuso
da empresa; reservas iniciadas na véspera não entram na contagem de hoje. Os dias
respeitam as mudanças da hora. As contagens usam `count: exact` com `head: true`,
sem depender da paginação ou do limite de linhas devolvidas pela API.

A lista mostra até cinco reservas confirmadas com início a partir do instante da
consulta e antes da meia-noite que termina o período. Ordena por início e ID.
Não inclui reservas já iniciadas. A ligação para a agenda dá acesso à consulta
detalhada. Não são pedidos contactos de clientes no resumo.

Todas as consultas usam as policies existentes: gestores veem a empresa e employees
apenas as reservas do profissional associado. Sem associação, a interface explica
como resolver e não pede o resumo. Não foi necessária migration.

A cache distingue conta, empresa, papel, fuso e associação ao profissional. O resumo
atualiza a cada minuto enquanto a página está ativa e pelo botão Atualizar resumo.
Esta atualização periódica não é Realtime. Contagens e lista são pedidos separados,
pelo que uma reserva confirmada durante a leitura pode refletir-se apenas numa parte
do resumo até à atualização seguinte. Falhas aparecem como erro, nunca como zero.

Testes novos cobrem limites locais/DST, contagens acima de mil reservas, filtros,
erros de leitura, gestores, colaboradores associados e ausência de associação.
Validação deste incremento: 209 testes frontend/API aprovados (10 novos), lint e
build aprovados. Não foram reexecutados testes SQL nem alterados dados na cloud.
O percurso completo no browser contra a cloud continua pendente; esta sessão não
dispunha de ferramenta para controlar o navegador.

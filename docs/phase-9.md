# Fase 9 — Reservas públicas

Estado: implementação e validação automatizada concluídas. Base privada de clientes/reservas,
disponibilidade, confirmação transacional, catálogo, gestão de publicação e formulário
público implementados. Validação manual completa no browser contra a cloud pendente.

## Clientes

`customers` pertence à empresa e guarda nome, email normalizado e telefone opcional.
O email não é único: contactos partilhados não devem fundir pessoas automaticamente.
Não há ligação automática entre customer e auth.users. Email preenchido não
equivale a identidade ou posse da conta verificada.

## Reservas

`bookings` referencia empresa, cliente, colaborador e serviço. Todas as referências
ao catálogo/cliente incluem business_id, impedindo misturar tenants.
Guarda starts_at/ends_at como instantes e snapshots de nome do serviço, nome do
profissional, duração, preço e moeda EUR. Alterar o catálogo não modifica estes valores.
Fim deve corresponder ao início mais a duração real em minutos; extremos finitos.
Mantém o limite de 31 dias do motor de disponibilidade.

Estados: confirmed e cancelled. A exclusão GiST do intervalo [início, fim) por
employee_id aplica-se só a confirmed. Reservas adjacentes são válidas; duplicação,
interseção ou reativação sobre outra reserva confirmada são rejeitadas pela BD.
Esta é a barreira estrutural contra concorrência. A RPC confirm_booking valida
horário, estado, serviço atribuído, bloqueios e passado antes da inserção.
Uma inserção privilegiada feita manualmente não passa pela validação da RPC.

request_id tem unicidade por empresa. A confirmação guarda request_fingerprint
(SHA-256 do payload normalizado) e serializa tentativas com a mesma chave.
Repetir a chave só devolve o recibo anterior se o payload também coincidir.

As FKs preservam história: apagar um cliente/serviço/profissional referenciado é
bloqueado. Eliminação administrativa de uma empresa continua a usar as cascatas da
empresa. updated_at reutiliza o trigger comum. Não foi criado catálogo de exemplo.

## Acesso a dados

Nenhum cliente anon ou authenticated pode inserir, alterar ou apagar diretamente
estas tabelas. A criação passa pela RPC restrita confirm_booking, com validação e
transação; não existe INSERT anónimo nas tabelas.

Owner/admin consultam reservas e clientes da própria empresa. Employee com user_id
associado a um profissional vê somente as reservas desse profissional e os clientes
com essas reservas. Sem essa associação, o papel employee não dá acesso a PII da agenda.
Este acesso é mais restrito do que a leitura do catálogo interno de Services/Employees.

Para consultar vagas de outros profissionais da mesma empresa, o helper privado
`private.booking_busy_periods` devolve apenas starts_at/ends_at de reservas confirmadas.
É SECURITY DEFINER com search_path vazio e valida a membership antes de ler. Não
devolve nomes, contactos, snapshots ou IDs de clientes. Anon não pode executá-lo.

A RPC privada get_availability_context mantém os filtros de tenant e passou a
incluir booking_periods. O frontend exige esse campo e desconta os intervalos no
motor existente. Uma resposta incompleta é erro, nunca uma agenda sem reservas.
Quando o cliente não pode ler detalhes de uma reserva de um colega, a vaga continua
corretamente ocupada.

## Validação deste incremento

Migration `20260917001300_create_booking_foundation.sql` aplicada em booking-saas-dev.
65 novos testes SQL, com fixtures revertidas: isolamento de tenant, visibilidade
por papel e agenda, grants de escrita fechados, FKs, snapshots, validações de dados,
overlap/adjacência, cancelamento/reativação e exposição mínima dos períodos ocupados.
O teste de exclusão é transacional/sequencial; não foi executado um ensaio com dois
pedidos HTTP simultâneos neste incremento.

Suite completa: 425 testes SQL e 145 testes frontend/API aprovados. Tipos Supabase
regenerados. A regressão frontend inclui a remoção de vagas por reservas reais no
contexto e rejeição de respostas que omitem essa fonte.

## Confirmação no servidor — segundo incremento

Migrations 014 e 015 aplicadas em booking-saas-dev. A coluna
businesses.public_booking_enabled começa false para todas as empresas.
Não foi ativada nenhuma empresa real. A interface de publicação fica para o
próximo incremento; atualmente só uma operação administrativa pode ativá-la.

confirm_booking aceita slug, profissional, serviço, instante inicial, UUID do
pedido e contactos. Preço, duração, fim e snapshots vêm exclusivamente do servidor.
Cliente e reserva são criados na mesma transação. Falha de validação ou exclusão
reverte tudo, sem clientes órfãos. O recibo omite contactos e customer_id.

Os horários adjacentes são unidos, a grelha tem origem no turno do dia inicial e
a duração é medida em minutos reais. Turnos contínuos podem atravessar meia-noite.
Limites locais inexistentes ou ambíguos na mudança de hora são rejeitados.
Dias futuros só são expandidos até cobrir a duração, como no motor TypeScript.

Um retry exato devolve a reserva já persistida, mesmo se o catálogo ou a publicação
mudar entretanto. Chave reutilizada com outros dados retorna 22023. O formulário
deverá manter o UUID enquanto o resultado for incerto e criar outro ao mudar o
pedido. 23P01 significa conflito de vaga; 42501, seleção indisponível; 22023,
pedido inválido. Erros transitórios de transação devem repetir a mesma chave.

Locks protegem catálogo e pedido. Neste MVP, SHARE nas tabelas de horários,
bloqueios e associações impede alterações durante validação/commit, incluindo
DML direto autorizado. São locks globais: podem atrasar edições noutras empresas;
antes de escalar, substituir por um protocolo de locks por profissional também
nos caminhos de edição. Não existe chamada de rede dentro da transação.

36 novos testes SQL cobrem publicação fechada, validação, snapshots, retries,
conflitos, rollback, permissões, meia-noite e DST. Suite: 461 testes SQL e 145
frontend/API; build e lint passam. Mantém-se o aviso já existente de chunk >500 kB.
`npm run db:test:concurrency` usa transações simultâneas com fixtures sintéticas
exclusivas, removidas no finally: uma vaga tem um vencedor; retries simultâneos
criam uma única reserva e cliente. O script só aceita o projeto de desenvolvimento.

## Catálogo público — terceiro incremento

Migration `20260918001600_add_public_booking_catalog.sql` aplicada em desenvolvimento.
A RPC `get_public_booking_catalog(target_business_slug)` permite consultar o catálogo
sem login, mas só se a empresa estiver ativa e tiver `public_booking_enabled = true`.
Nenhuma empresa real foi publicada neste incremento.

O contrato JSON contém `business` (nome, slug e timezone) e `services` (id, nome,
duração, preço em cêntimos, moeda EUR e profissionais associados com id e nome).
Só inclui serviços ativos com duração suportada pelo motor (até 31 dias) e pelo
menos um profissional ativo associado da mesma empresa. Catálogo sem opções
devolve `services: []`. A ordenação por nome e id torna o resultado estável.

### Como funciona

Uma RPC é uma função da base de dados que o frontend pode chamar pelo Supabase.
Esta função recebe o slug, encontra uma empresa publicada e constrói uma resposta
com campos explícitos através de `jsonb_build_object`. Não devolve linhas inteiras
das tabelas. Assim, adicionar uma coluna privada no futuro não a torna pública.

`SECURITY DEFINER` permite à função consultar tabelas que o visitante não pode ler
diretamente. Por isso a própria função verifica publicação, atividade e empresa em
cada relação. `search_path = ''` e nomes de tabelas qualificados evitam resolver
objetos de um schema inesperado. O privilégio EXECUTE é concedido a `anon` e
`authenticated`; não foram concedidos novos privilégios SELECT nas tabelas.

Empresa inexistente, inativa ou sem publicação devolve o mesmo erro 42501.
O catálogo não consulta clientes, reservas, bloqueios ou contas de utilizador.
Um serviço listado ainda pode não ter vagas: catálogo e disponibilidade são
responsabilidades diferentes, e a confirmação volta a validar a seleção.

### Validação e exercício manual

Os 13 testes novos verificam o contrato completo, isolamento, permissões, filtros
e retirada da publicação. A suite SQL completa passou: 474 testes, com rollback
das fixtures. Os tipos TypeScript foram regenerados a partir do esquema aplicado.

Ainda não existe página para testar esta consulta no browser. Para explorar a
função sem publicar uma empresa real, executar a suite específica:

```sh
npm run db:test:cloud -- supabase/tests/database/public_booking_catalog.test.sql
```

Ler o primeiro teste e comparar o JSON esperado com os campos construídos pela
função. Os testes seguintes mostram como a resposta muda ao desativar um serviço,
um profissional ou a publicação. Todos os dados de teste são revertidos no fim.

## Disponibilidade pública — quarto incremento

### OBJECTIVE

Consultar vagas por slug, profissional, serviço e data local da empresa, sem
expor a agenda interna. Implementado pela migration 017 e por um adaptador
TypeScript; ainda não existe interface pública.

### CONCEPTS

Uma vaga é uma possibilidade calculada num instante, não uma reserva. Uma RPC
pública pode devolver apenas o resultado do cálculo, mantendo as fontes privadas.
Datas locais identificam o dia na empresa; instantes UTC identificam o momento
exato e permitem medir a duração real mesmo na mudança de hora.

### ARCHITECTURE

`getPublicAvailability` → RPC `get_public_booking_availability` → helper privado
`booking_working_periods` → exclusão de bloqueios e reservas confirmadas → vagas.
O helper de horários é o mesmo usado por `confirm_booking`. O motor TypeScript
continua a servir a consulta privada; a consulta pública calcula no servidor para
não enviar períodos ocupados ao visitante.

### IMPLEMENTATION PLAN

Reutilizar o helper de horários da confirmação, validar publicação e seleção,
gerar a grelha, remover conflitos, validar a resposta no adaptador e executar
testes SQL/API. Migration aplicada apenas no projeto de desenvolvimento.

### WHAT WE BUILT / HOW IT WORKS

A RPC valida empresa ativa e publicada, serviço ativo, profissional ativo e
associação entre ambos na mesma empresa. Datas inválidas e duração acima de 31
dias são rejeitadas. `generate_series` gera candidatos a partir do início de cada
período de trabalho unido, segundo o intervalo de marcação da empresa.

O fim deve caber no período de trabalho. Só devolvemos inícios no dia pedido e
a partir de `statement_timestamp()`. Intervalos que se sobrepõem a bloqueios ou
reservas confirmadas são removidos; adjacência é permitida e cancelamentos deixam
de ocupar a vaga. Turnos contínuos podem permitir que uma reserva termine no dia
seguinte. Limites de horário ambíguos ou inexistentes em DST causam erro explícito,
reutilizando o comportamento da confirmação.

A resposta contém apenas `server_now`, `timezone`, `duration_minutes` e `slots`
com `starts_at`/`ends_at`. Não inclui reservas, contactos, motivos de bloqueio,
identificadores de clientes ou horários semanais. A leitura usa um snapshot
coerente, sem bloquear a agenda nem prometer que a vaga ficará livre depois.

### FILES CHANGED / IMPORTANT CODE

- `supabase/migrations/20260918001700_add_public_booking_availability.sql`: RPC e grants.
- `supabase/tests/database/public_booking_availability.test.sql`: testes de regras e acesso.
- `src/features/availability/api/public-availability-api.ts`: valida pedidos e respostas,
  envia AbortSignal e converte instantes para o formato de intervalos usado no frontend.
- `src/features/availability/api/public-availability-api.test.ts`: contrato do adaptador e erros.
- `src/lib/supabase/database.types.ts`: tipos regenerados do esquema.

`starts_at < fim_candidato AND ends_at > inicio_candidato` identifica sobreposição
sem rejeitar dois intervalos adjacentes. `SECURITY DEFINER` permite a leitura interna;
por isso a função verifica explicitamente publicação e empresa. `search_path` vazio
e tabelas qualificadas evitam resolução de objetos noutros schemas. UTC é fixado
na função para serialização e aritmética previsíveis.

### GOOD PRACTICES USED

Contrato público mínimo, reutilização das regras de confirmação, validação Zod
da resposta e erros explícitos. Resposta incompleta ou erro de rede nunca é tratado
como lista de vagas válida. Nenhuma empresa real foi publicada. Fixtures de teste
são revertidas no fim.

### THINGS TO TEST

Validação deste incremento: 26 novos testes SQL e 9 testes do adaptador.
Suite completa aprovada: 500 testes SQL e 154 frontend/API. Lint e build passam;
mantém-se o aviso existente de chunk acima de 500 kB.

Ainda não há controlos novos no browser. Executar a suite específica com
`npm run db:test:cloud -- supabase/tests/database/public_booking_availability.test.sql`
e os testes do adaptador com
`npm test -- src/features/availability/api/public-availability-api.test.ts`.
No SQL, acompanhar o percurso consulta → confirmação → vaga removida → cancelamento
→ vaga novamente livre. Ver também as verificações de meia-noite e DST.

### WHAT I LEARNED / NEXT STEP

Consultar não reserva uma vaga. Calcular no servidor permite esconder as fontes
da agenda. Reutilizar regras reduz diferenças entre o que se apresenta e o que se
aceita na confirmação. O próximo passo é permitir ao owner/admin gerir a publicação;
depois, ligar catálogo, vagas e confirmação ao formulário público.

## Gestão da publicação — quinto incremento

### OBJECTIVE

Permitir ao proprietário e aos administradores ativar ou desativar reservas
públicas na página privada da empresa.

### CONCEPTS

Autorização no servidor, escrita por RPC, estado remoto e cache do TanStack Query.
Enviar o estado desejado torna a operação idempotente: repetir `true` mantém a
publicação ativa em vez de a inverter.

### ARCHITECTURE

`BusinessPage` apresenta `PublicBookingSettings`, que usa a mutation
`useSetPublicBookingEnabled`. O adaptador chama `set_public_booking_enabled`.
A RPC valida a membership da sessão e só altera `public_booking_enabled`.
As consultas públicas e a confirmação já verificam esse campo.

### IMPLEMENTATION PLAN

Criar a RPC restrita, incluir a publicação na leitura da empresa, adicionar o
controlo, atualizar a cache após resposta e testar os papéis e os estados da UI.

### WHAT WE BUILT / HOW IT WORKS

A secção Reservas públicas mostra o estado atual e permite ativar/desativar a
publicação a owner/admin. Employee vê o estado mas não recebe botão. A descrição
explica o acesso sem login e a preservação das reservas existentes; informa também
que a página pública ainda não está disponível. Nenhuma empresa real é ativada
automaticamente pela migration.

O servidor obtém a identidade de `auth.uid()` através do helper de membership;
não aceita user_id nem papel fornecidos pelo frontend. Rejeita visitantes,
colaboradores, utilizadores externos e empresas de outro tenant. Uma empresa
inativa pode desativar a publicação, mas não ativá-la.

A operação bloqueia a linha da empresa durante a atualização. Isso coordena a
escrita com o lock usado pela confirmação de reservas. Uma confirmação que já
obteve o lock pode terminar antes da desativação; pedidos novos após a desativação
não criam reservas. Repetir uma confirmação já concluída pode devolver o recibo
anterior, preservando o contrato idempotente existente.

O botão fica desativado enquanto grava. Não há atualização otimista: depois da
resposta bem-sucedida, cancelamos leituras antigas, atualizamos a cache da empresa
e invalidamos os detalhes e a lista para voltar a consultar o servidor.
Falhas mostram uma mensagem e permitem nova tentativa.

### FILES CHANGED / IMPORTANT CODE

- Migration 018: função `set_public_booking_enabled(uuid, boolean)` e grant EXECUTE.
- `public_booking_settings.test.sql`: permissões e efeito na leitura pública.
- `business-api.ts`: seleção do campo e adaptador da escrita, validado com Zod.
- `business.types.ts`: publicação incluída em `BusinessSummary`.
- `use-businesses.ts`: mutation e sincronização da cache.
- `public-booking-settings.tsx`: estado, ação e feedback acessível.
- `public-booking-settings.test.tsx`: interação com mutation real e RPC simulada.
- `business-page.tsx`: integração da secção, com key por empresa.
- `database.types.ts`: contrato da RPC gerado a partir do esquema.

### GOOD PRACTICES USED

Permissões verificadas no servidor e UI, grants de UPDATE direto mantidos fechados,
função com search_path vazio, validação do estado booleano, bloqueio de submissões
durante a gravação e feedback de sucesso apenas após confirmação do servidor.

### THINGS TO TEST

Abrir a empresa em `/dashboard`, encontrar Reservas públicas e verificar que
owner/admin conseguem ativar e desativar. Recarregar a página para confirmar a
persistência. Testar com um employee para verificar a ausência de botão.
Simular modo offline no browser: deve aparecer erro, sem anunciar sucesso, e ser
possível repetir depois de recuperar a ligação. Ativar permite acesso público às
operações já implementadas; usar uma empresa de teste e desativar no fim.

Validação: migration 018 aplicada em desenvolvimento e tipos regenerados.
18 novos testes SQL e 6 testes de interface aprovados; suite completa com 518
testes SQL e 160 frontend/API. Lint e build passam, mantendo o aviso existente
de chunk acima de 500 kB. O percurso manual no browser fica por executar.

### WHAT I LEARNED / NEXT STEP

Esconder um botão não substitui autorização no servidor. A cache precisa de ser
sincronizada após uma escrita. Definir um estado explícito permite repetir pedidos
sem inverter a intenção. O próximo incremento é a página pública com catálogo,
vagas, contactos, revisão e confirmação.

## Formulário público — sexto incremento

### OBJECTIVE

Permitir reservar sem login em `/book/:slug`: serviço, profissional, data, vaga,
contactos, revisão e confirmação. A gestão da empresa apresenta o link quando
a publicação está ativa e a empresa está ativa.

### CONCEPTS

Consultas dependentes e chaves de cache, formulários validados com React Hook Form
e Zod, estados do pedido e idempotência. Um timeout pode acontecer depois do commit:
nesse caso é necessário repetir a mesma chave e os mesmos dados para recuperar o
resultado, sem criar outra reserva.

### ARCHITECTURE / IMPLEMENTATION PLAN

A rota pública está fora de ProtectedRoute e usa o layout e componentes existentes.
`booking-api.ts` valida o catálogo, normaliza contactos, chama a confirmação e
valida o recibo. `public-booking-page.tsx` liga esse adaptador à disponibilidade
pública existente. Nenhuma migration foi necessária neste incremento.

### WHAT WE BUILT / HOW IT WORKS

O catálogo publicado fornece os serviços e profissionais associados. As consultas
de vagas só começam depois da seleção completa e têm uma chave que inclui slug,
serviço, profissional e data. Alterar a seleção limpa a vaga escolhida; respostas
antigas ficam associadas à respetiva chave e não substituem a seleção atual.

O formulário recolhe nome e email obrigatórios e telefone opcional. A revisão
mostra serviço, duração, preço, profissional, horário, fuso e contactos antes de
enviar. O cliente não envia preço, duração ou fim para a confirmação: estes valores
continuam a ser calculados pelo servidor. O recibo apresenta os valores efetivamente
guardados, a referência e o estado; não promete envio de email.

Uma nova revisão gera um UUID. Antes de submeter, guardamos UUID e payload no
sessionStorage da aba, separados por slug. O armazenamento inclui os contactos do
pedido pendente e é limpo quando recebemos sucesso ou erro definitivo. Não usamos
localStorage, URLs nem logs para os contactos. A conservação acompanha a sessão da
aba; fechar a aba pode perder a recuperação local. Falha ao guardar impede enviar.

Durante a confirmação não é possível editar ou enviar um pedido diferente. Erros
23P01, 42501 e 22023 são tratados como definitivos; o cliente pode voltar à seleção.
Falhas de rede, erros transitórios e recibos inválidos mantêm o pedido como incerto.
O botão Verificar reserva repete exatamente o payload e UUID. Recarregar a página
recupera esse pedido antes de consultar o catálogo, permitindo obter um recibo
anterior mesmo que a empresa entretanto tenha fechado a publicação.

Horários normais e recibos usam o fuso da empresa. Quando recuperamos um pedido
sem catálogo, apresentamos o instante em UTC com indicação explícita do fuso.
Um recibo com estado cancelled apresenta Reserva cancelada, não confirmação.

### FILES CHANGED / IMPORTANT CODE

- `src/features/booking/booking-api.ts`: schemas, RPCs, classificação de erros e pedido pendente.
- `src/features/booking/public-booking-page.tsx`: seleção, revisão, envio, recuperação e recibo.
- Testes ao lado destes ficheiros: contrato e interação com RPCs simuladas.
- `src/app/router.tsx`: rota `/book/:slug`, carregada com lazy.
- `src/app/layouts/public-layout.tsx`: título da página de reservas.
- `src/features/businesses/components/public-booking-settings.tsx`: link da empresa publicada.
- README e este guia: estado e instruções de validação.

### GOOD PRACTICES USED

Reutilização dos componentes visuais e do servidor, escolha limitada ao catálogo,
campos com labels e erros, proteção contra duplo envio, validação de respostas,
recuperação de resultado incerto e separação entre confirmação e envio de email.
Sucesso só aparece depois de obter um recibo válido do servidor.

### THINGS TO TEST

Validação automatizada: 178 testes frontend/API aprovados (18 novos), lint e build
aprovados. O build deste incremento deixou de emitir o aviso de chunk >500 kB.
Os 518 testes SQL da etapa anterior continuam como última validação do backend;
não houve alterações SQL nem repetição da suite cloud neste incremento.

O percurso manual no browser contra a cloud NÃO foi executado:

1. Executar `npm run dev`, entrar como owner/admin numa empresa de teste e configurar
   serviço ativo, profissional associado e horário futuro.
2. Ativar publicação e abrir o link `/book/:slug` numa janela sem login.
3. Selecionar serviço, profissional, data e vaga; preencher contactos; rever e confirmar.
4. Verificar referência e dados do recibo. Noutro acesso, confirmar que a vaga desapareceu.
5. Abrir a mesma vaga em duas abas antes de confirmar: só uma deve conseguir reservar.
6. Simular perda da resposta à confirmação: o estado incerto deve permitir verificar
   o mesmo pedido; atualizar a aba deve preservar essa recuperação.
7. Desativar publicação: novos visitantes não devem conseguir consultar o formulário.
8. Testar teclado, ecrã pequeno, ausência de vagas e validação dos contactos.

Usar contactos sintéticos: o fluxo cria reservas reais na base de desenvolvimento.
Não existe ainda interface de gestão/cancelamento; essa funcionalidade pertence
à fase 11. Não houve deploy nem publicação automática de empresas reais.

### WHAT I LEARNED / NEXT STEP

Uma falha de rede não prova que a escrita falhou. A chave idempotente deve acompanhar
o pedido enquanto o resultado for incerto. Chaves de cache completas evitam misturar
respostas de seleções diferentes. O servidor decide os valores efetivos da reserva.
O próximo passo é validar manualmente o percurso completo; depois seguir para
o dashboard da fase 10.

## Estado do fluxo público

1. Catálogo e consulta pública de vagas concluídos no servidor e adaptador de disponibilidade preparado.
2. Interface owner/admin para ativar explicitamente a marcação pública concluída.
3. Formulário público com escolha de vaga, contactos, revisão e confirmação concluído;
   sucesso apresentado após recibo válido. Não existe envio de mensagens.

Não houve deploy Vercel. A RPC aceita anon, mas novas reservas exigem publicação
explícita da empresa. Não foram abertos SELECT nem INSERT anónimos nas tabelas.

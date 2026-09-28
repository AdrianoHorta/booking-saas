# Modo de demonstração

> Histórico: desde 28 de setembro de 2026, a demonstração deixou de estar
> disponível na aplicação publicada. `/demo` encaminha para `/`; o código abaixo
> permanece no repositório, sem ser importado ou incluído no build de produção.
> Os percursos públicos atuais são validados em `e2e/product.spec.ts`.

## OBJECTIVE

Apresentar os percursos de reserva e gestão de uma barbearia com dados fictícios,
sem criar conta, configurar Google ou escrever na base de dados.

## CONCEPTS

Separação entre dados reais e exemplos, persistência por aba, simulação de
disponibilidade e carregamento separado do código da aplicação real.

## ARCHITECTURE

`/demo` e `/demo/` carregam uma aplicação local independente. `application.tsx`
escolhe por import dinâmico entre `demo-page` e `live-app`. O ramo de demonstração
não importa AuthProvider, QueryProvider ou o cliente Supabase. Entrar e sair usa
ligações normais que carregam um novo documento, garantindo essa separação.

Partilha os componentes visuais Button, FormField, Dialog e Message. O modelo
de demonstração é uma simulação explícita; os percursos reais continuam a usar
as APIs e regras SQL existentes. Alterar os exemplos nunca altera uma empresa real.

## IMPLEMENTATION PLAN

1. Isolar o ponto de entrada e acrescentar a ligação na página inicial.
2. Criar modelo local com profissionais, serviços, vagas e reservas.
3. Construir perspetivas de cliente, empresa e Miguel.
4. Testar os percursos, a persistência e o isolamento de rede/sessão.

## WHAT WE BUILT

A Barbearia Horizonte tem Miguel e Ana, dois serviços (30/60 minutos), dois
clientes fictícios e vagas entre as 10h e as 18h nos próximos sete dias, a partir
de amanhã. O cliente pode rever e confirmar uma reserva e cancelar dentro do
prazo de 12h. A empresa seleciona um profissional; a agenda individual do Miguel
omite o campo redundante do profissional. A equipa pode reagendar.

Os cards separam duração e preço, com o valor destacado em baixo à direita.
Cancelamento, reagendamento e reposição exigem confirmação. O botão Repor exemplos
reinicia apenas a demonstração. Não existem emails, credenciais ou eventos Google.

## HOW IT WORKS

O estado fica em memória e é guardado em `sessionStorage`, na chave exclusiva
`booking-demo-v1`. Recarregar a mesma aba mantém as alterações durante esse dia.
Ao abrir noutro dia, os exemplos são recriados com datas futuras. Dados inválidos
também são substituídos por exemplos novos. Se o browser recusar a gravação, a
simulação continua em memória e informa que não será preservada ao sair.

Duplicar uma aba pode copiar inicialmente o sessionStorage, conforme o browser;
as alterações posteriores são independentes. Não há sincronização entre abas.
O modo de demonstração não lê nem apaga o armazenamento da sessão real.

As vagas usam a data local da empresa em Europe/Lisbon, respeitam a duração do
serviço e excluem sobreposições entre reservas confirmadas do mesmo profissional.
Reagendar ignora a própria reserva no cálculo e preserva identidade/preço/duração.
Cancelar liberta a vaga. O relógio local determina o prazo nesta simulação;
na aplicação real, a autoridade é o servidor.

## FILES CHANGED

- `src/main.tsx`: apresenta a aplicação escolhida com Suspense.
- `src/app/application.tsx`: escolhe o bundle pelo endereço inicial.
- `src/app/live-app.tsx`: mantém os providers e router da aplicação real.
- `src/features/demo/demo-model.ts`: exemplos, persistência validada e operações locais.
- `src/features/demo/demo-page.tsx`: interface e confirmações.
- `src/features/demo/demo-model.test.ts`: sobreposição, duração, DST, prazo e recuperação.
- `src/features/home/pages/home-page.tsx`: entrada na demonstração e texto atualizado.
- `e2e/demo.spec.ts`: percurso completo, isolamento e navegação.
- README e documentação: instruções e limites.

## IMPORTANT CODE

`slots` trabalha com intervalos em milissegundos e converte horas locais através
de Temporal. `reserve`, `move` e `cancel` devolvem um estado novo sem modificar
o anterior. `restore` valida o formato antes de aceitar dados guardados.

O import dinâmico fica antes de inicializar a autenticação: ocultar botões ou
trocar apenas uma URL de API não garantiria que a demonstração estivesse isolada.

## GOOD PRACTICES USED

Identificação visível de demonstração, dados fictícios, chave de armazenamento
exclusiva, confirmação de operações, recuperação de armazenamento inválido,
componentes partilhados e testes automáticos de isolamento.

## THINGS TO TEST

Não é necessária configuração manual agora. Para apresentar depois:

1. Executar `npm run dev` e abrir a app no endereço indicado pelo terminal.
2. Escolher **Experimentar demonstração**, ou acrescentar `/demo` ao endereço.
3. Reservar como cliente usando um nome fictício.
4. Alternar para Empresa e escolher Miguel ou Ana.
5. Abrir Agenda do Miguel, reagendar e voltar à vista Cliente.
6. Cancelar dentro do prazo e usar Repor exemplos para recomeçar.

Validação: 255 testes Vitest, build e lint aprovados. A suite de browser inclui
48 testes (8 novos da demonstração); a repetição dirigida corrige a expectativa
do formato de data português. O percurso foi executado em desktop e emulação móvel.
Os testes confirmam que o cliente Supabase não é carregado ao abrir diretamente
a demonstração e que repor os exemplos preserva uma sessão existente.

Esta é uma apresentação dos percursos principais. Não inclui gestão de membros,
configuração de serviços/horários, política de cancelamento editável, filtros
completos, contactos reais ou autenticação de pessoas. As perspetivas são uma
simulação e não constituem um controlo de acesso. Sem deploy nesta etapa.

## WHAT I LEARNED

Uma demonstração deve permitir explorar sem confundir exemplos com operações
reais. Separar o ponto de entrada evita inicializar serviços que não são necessários.

## NEXT STEP

Melhorar a apresentação e acessibilidade dos percursos reais, mantendo a
configuração externa de Google e email para quando houver disponibilidade.

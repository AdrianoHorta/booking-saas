# Gestão de membros e roteiro de demonstração

## OBJECTIVE

Associar contas existentes à empresa pela interface, gerir permissões e ligar
essas contas aos profissionais, sem operações manuais no Supabase.

## CONCEPTS

- Conta: identidade autenticada em auth.users.
- Membro: acesso à empresa em business_members, com papel owner/admin/employee.
- Colaborador: profissional em employees, com serviços e horários, opcionalmente
  ligado a uma conta que já é membro da empresa.

Ter login não cria uma empresa nem uma associação automática a um profissional.
Um cliente que reserva publicamente não precisa de ser membro nem de ter conta.

## ARCHITECTURE

A secção Acesso à empresa em BusinessPage usa BusinessMembers e members-api.ts.
As RPCs list_business_members, save_business_member e remove_business_member
executam no servidor com identidade obtida da sessão, nunca de um papel indicado
pelo browser. A listagem de emails está limitada aos gestores da empresa.
O formulário de profissionais reutiliza a listagem para mostrar emails.

## IMPLEMENTATION PLAN

Criar operações restritas, integrar a UI, atualizar o seletor de contas e tipos,
testar permissões e preservação dos dados, aplicar no ambiente de desenvolvimento.

## WHAT WE BUILT

Gestão de contas já registadas por email. O proprietário pode adicionar
colaboradores/administradores e alterar ou remover esses membros. Administradores
podem adicionar e remover membros employee, mas não promover ou gerir outros
administradores. Não existe transferência de propriedade nem alteração do próprio
acesso. Convites por email não estão implementados.

## HOW IT WORKS

A adição normaliza o email, encontra uma conta existente e guarda a membership.
Se já existir, atualiza o papel autorizado; repetir o pedido não duplica membros.
A edição dos papéis é feita por botões na lista. Retirar acesso pede confirmação
na interface e, numa única transação, remove a associação de login dos profissionais
daquela empresa antes de remover a membership. Profissionais, serviços, horários,
clientes, reservas e a conta global são preservados.

As operações bloqueiam a linha da empresa e voltam a verificar o papel do gestor
após obter o lock, serializando alterações de membros por empresa. Escrita direta
nas tabelas de membros continua sem grants. O servidor protege a propriedade e
impede elevação de privilégios por administradores ou colaboradores.

Após uma escrita, a interface invalida as consultas de membros, opções de conta
e profissionais. Noutros browsers já abertos, os dados podem continuar em cache
até à próxima consulta; o servidor verifica as permissões em cada novo acesso.

## FILES CHANGED

- Migration 019 e business_members_management.test.sql: RPCs e segurança.
- members-api.ts: validação de entradas/respostas e mensagens de erro.
- business-members.tsx e respetivos testes: lista, formulário, papéis e remoção.
- business-page.tsx: integração da secção.
- employees-api.ts e respetivo teste: opções obtidas através da RPC de membros.
- employee-form.tsx: emails no seletor de contas.
- database.types.ts: tipos regenerados.
- README e este roteiro: estado e instruções de teste.

## IMPORTANT CODE

`private.has_business_role` verifica a membership de `auth.uid()`. A função não
aceita uma identidade do gestor fornecida pelo cliente. O papel solicitado só
pode ser employee ou admin, e um admin só pode solicitar employee.

Na remoção, `UPDATE employees SET user_id = NULL` precede o DELETE de membership.
Isto respeita a chave estrangeira e preserva a história da agenda. Todas as
operações dessa remoção pertencem à mesma transação.

## GOOD PRACTICES USED

Permissões verificadas no servidor, acesso mínimo aos emails, propriedade protegida,
operações transacionais e repetíveis, UI com estados de erro/gravação e confirmação
explícita para retirada de acesso. Sem service-role key no frontend nem envio de emails.

## THINGS TO TEST

Validação automática realizada: 554 testes SQL (36 novos), 184 frontend/API
(6 novos), lint e build aprovados. Migration aplicada em booking-saas-dev.
Os testes SQL usam dados sintéticos com rollback. O percurso manual completo no
browser contra a cloud continua pendente. Nenhuma conta real foi associada por
esta migration nem por scripts de teste.

### Associar o Miguel

1. Iniciar sessão como proprietário e abrir a empresa.
2. Em Acesso à empresa, escrever `miguel@miguel.com`, escolher Colaborador e guardar.
3. Confirmar que o email aparece na lista. Se não existir, verificar o email usado
   no registo; a aplicação não cria uma conta automaticamente nem envia convite.
4. Abrir Gerir colaboradores e criar/editar o perfil Miguel.
5. Em Conta associada (opcional), escolher `miguel@miguel.com` e guardar.
6. Associar os serviços que o Miguel presta, ativar o profissional e configurar horários.
7. Numa janela privada, entrar como Miguel. Deve conseguir abrir a empresa, consultar
   catálogo e disponibilidade, sem botões de gestão de membros ou publicação.

Se a conta já for proprietária da empresa, saltar a adição; não tentar mudar o papel
de proprietário. Uma conta só pode estar ligada a um profissional por empresa.

### Demonstração com três perspetivas

**Proprietário:** criar/configurar empresa, serviços com preço/duração, membros,
profissionais, horários e bloqueios; consultar disponibilidade; ativar publicação.

**Colaborador:** entrar com a conta associada, abrir a empresa e As minhas reservas.
Selecionar o período da marcação e verificar o cliente e o horário. A consulta já
existe; alteração/cancelamento ainda não estão disponíveis.

**Cliente:** abrir `/book/slug-da-empresa` sem login, selecionar serviço, profissional,
data e vaga, preencher contactos sintéticos, rever e confirmar. Guardar referência.
Consultar novamente e verificar que a vaga desapareceu. Não é enviado email.

### Casos que convém verificar antes da apresentação

- Recarregar após adicionar membro: a associação continua guardada.
- Email inexistente: erro claro, sem inventar uma conta.
- Conta de employee: sem acesso à gestão de membros e sem possibilidade de editar
  serviços/profissionais/publicação pela interface.
- Duas abas na mesma vaga: uma confirmação ganha e a outra apresenta conflito.
- Falha de ligação após confirmação: repetir o pedido pelo botão Verificar reserva;
  o mesmo UUID deve recuperar o resultado em vez de duplicar.
- Desativar publicação: novos visitantes deixam de consultar/reservar.
- Retirar acesso numa conta de teste: na próxima consulta a empresa deixa de estar
  acessível; o perfil profissional continua na equipa, sem conta associada.
- Ecrã pequeno e navegação por teclado: seleção, revisão, mensagens e botões legíveis.

Executar localmente com `npm run dev`. Isto não disponibiliza automaticamente uma
URL na internet para o teu tio: não houve deploy. As reservas criadas pelo formulário
são reais no ambiente de desenvolvimento, por isso usar contactos sintéticos.

## WHAT I LEARNED

Conta, acesso à empresa e profissional são entidades distintas. Revogar acesso
não deve apagar a história do negócio. Autorizações do servidor são necessárias
mesmo quando os botões estão escondidos. Testes automáticos não substituem avaliar
a clareza do percurso numa demonstração manual.

## NEXT STEP

Executar este roteiro no browser. Para apresentação, explicar que já se pode
configurar o negócio, receber uma reserva pública e vê-la na agenda privada.
Dashboard resumido, gestão/cancelamento de marcações, notificações por email,
integração Google Calendar e deploy continuam pendentes. Ver o incremento de
[consulta de reservas da fase 10](phase-10.md).

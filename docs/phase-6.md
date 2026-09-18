# Fase 6 — Employees

Estado: implementação e validação automatizada concluídas. Base de dados, RLS,
API, hooks e interface de gestão disponíveis. Smoke test visual em browser real
permanece por executar.

## Modelo

`business_members` define quem acede à aplicação e com que papel.
`employees` define profissionais que poderão receber reservas. Um owner ou admin
também pode ser profissional; um profissional pode existir sem conta de login.

`employees`: id UUID, business_id, name (1–100 caracteres após trim), user_id
opcional, is_active, created_at e updated_at. O trigger existente
`private.set_updated_at()` mantém o timestamp de atualização.

A FK `(business_id, user_id)` exige um membro da mesma empresa quando há login.
A constraint única permite apenas um perfil por conta/empresa e vários perfis
sem login. A mesma pessoa pode trabalhar em empresas diferentes. Ligar um perfil
não cria memberships, não altera roles e não constitui consentimento OAuth.
Antes de remover uma membership ligada, é necessário desligar o perfil.

`employee_services`: business_id, employee_id, service_id e created_at.
A chave primária evita duplicados. Ambas as FKs incluem business_id; nem um
manager das duas empresas pode criar uma relação entre tenants diferentes.
Foi acrescentada uma constraint única `(business_id, id)` em services para essa FK.
As constraints únicas de employees já fornecem índices iniciados por business_id;
employee_services tem também índice para pesquisa por empresa/serviço.

## Permissões

| Operação | Owner/admin da empresa | Employee da empresa | Outsider/anon |
| --- | --- | --- | --- |
| Consultar colaboradores e serviços associados | Sim | Sim | Não |
| Criar/editar/desativar colaborador | Sim | Não | Não |
| Ligar/desligar membro existente da mesma empresa | Sim | Não | Não |
| Associar/desassociar serviço | Sim | Não | Não |
| Apagar colaborador | Não | Não | Não |
| Alterar id, tenant ou timestamps diretamente | Não | Não | Não |

Policies seguem `private.has_business_role`. Grants por coluna limitam a escrita.
Desassociar um serviço apaga apenas a linha de employee_services, nunca o serviço
ou colaborador. Desativação preserva identidades e relações para histórico futuro.
As cascatas pertencem à manutenção dos registos pais; não concedem DELETE aos clientes.

## Decisões para as próximas fases

O catálogo interno permite guardar associações com serviços/colaboradores inativos.
O futuro motor de disponibilidade deverá exigir empresa, employee e service ativos
e associação existente para novas reservas. Reservas históricas mantêm snapshots
e referências próprias; remover uma associação não deverá apagar essas reservas.

Não há horários, reservas ou OAuth nesta migration. O futuro Calendar liga ao
employee, nunca apenas ao business. Quando existir OAuth, alterar user_id terá de
invalidar/desligar credenciais e jobs da ligação anterior numa operação server-side.
O campo atual não autoriza a utilização da conta Google de outra pessoa.

## Verificação

Migration `20260917000800_create_employees.sql` aplicada no projeto
booking-saas-dev. Tipos regenerados a partir da cloud.

- 70 testes SQL novos: operações de owner/admin, leitura employee, bloqueio de
  escrita employee/anon, outsider, isolamento, ligação a membro, duplicados,
  integridade das associações, ativação/desativação e updated_at.
- Suite cloud completa: 162 testes aprovados, com rollback das fixtures.
- Regressão frontend: 47 testes aprovados; build, TypeScript strict e lint aprovados.
  Mantém-se o aviso já existente de bundle principal acima de 500 kB.
- Nenhum colaborador de exemplo fica gravado pelos testes.

## Gestão de colaboradores

`src/features/employees` contém API tipada, hooks TanStack Query, schema Zod,
EmployeeForm e EmployeesPage. Rota protegida `/dashboard/:businessId/employees`,
acessível através de “Gerir colaboradores” na BusinessPage. Mantém cards brancos,
títulos serifados e modais com o diálogo partilhado extraído de Services.

Owner/admin criam, editam, associam serviços e ativam/desativam. Employee consulta.
Cada operação de estado tem loading próprio, incluindo operações concorrentes.
Os erros preservam os campos para repetir; troca de empresa desmonta o editor.
O cache usa `['employees', businessId]` e invalidação após gravar/alterar estado.
O QueryProvider existente isola o cache por conta autenticada.

O formulário aceita profissionais sem serviços e sem login. Mostra serviços
inativos identificados como tal, mantendo associações existentes. A lista opcional
de contas consulta apenas business_members da empresa. Como ainda não existe um
perfil público de membros com nome/email, os rótulos usam papel e UUID completo;
não há lookup de auth.users nem convites nesta fase.

Migration `20260917000900_add_save_employee.sql`: a RPC save_employee grava perfil
e seleção na mesma transação, como SECURITY INVOKER, preservando RLS e grants.
Uma FK inválida reverte inserções, edições e remoções de associações. O update do
perfil serializa gravações RPC concorrentes do mesmo colaborador; o último pedido
concluído determina a seleção. Não altera is_active durante edição do formulário.
Os valores opcionais omitidos pela API usam os defaults NULL da função SQL,
incluindo a remoção da ligação a uma conta. Ativação usa update filtrado por id e tenant.

## Validação do segundo incremento

- 29 testes SQL adicionais para a RPC; suite cloud completa: 191 aprovados.
- Suite frontend/API completa: 68 testes aprovados; build, lint e diff check aprovados.
- Testes React com hooks reais e API simulada: criação, edição, seleção/limpeza,
  erros, carregamento de opções, acesso employee e loading concorrente.
- Testes API para filtros de tenant, argumentos da RPC e erros; testes Zod.
- Testes existentes de Services verificam também a extração do diálogo partilhado.

A validação de componentes usa jsdom, não um browser real ligado à cloud. Antes de
publicar, abrir “Gerir colaboradores”, criar um perfil com dois serviços, editar,
limpar a seleção, desativar/ativar, testar Tab/Escape e verificar modal em mobile.
Testar também uma conta employee, que não deve ter ações de escrita.

## Próxima fase

Fase 7 — working hours/schedules por employee, com timezone IANA e exceções.
Não implementada neste incremento. Google Calendar permanece apenas planeado.

# Fase 5 — Services

Estado: concluída na revisão e validação automatizada em 2026-09-17.
Validação visual/E2E num browser real não executada nesta revisão.

## Estrutura confirmada

Feature em `src/features/services`: API, hooks TanStack Query, schema Zod,
ServiceForm partilhado, ServicesPage e ServiceDialog. Rota protegida
`/dashboard/:businessId/services`, com ligação na BusinessPage. Mantidos
PageHeading, Button, Message, cards brancos, cores editoriais e formulários em modal.

API usa `getSupabase()` e os tipos gerados de `public.services`. Listagem filtrada
por business_id e ordenada por nome. Updates filtram id e business_id; a empresa
vem do hook, não de campos do formulário. Query keys continuam
`['services', businessId]`; create/update aguardam a invalidação. QueryProvider
desmonta cache e consumidores quando muda a identidade autenticada.

## Correções verificadas

- Ações de gestão visíveis apenas a owner/admin; employee consulta o catálogo.
  A autorização efetiva permanece em RLS. Empresa inexistente/sem acesso não
  aparece como catálogo vazio editável; mudança de tenant desmonta estado local.
- Loading individual preservado e corrigido para operações simultâneas: um Set
  acompanha todos os serviços pendentes, removendo cada id no respetivo finally.
  Usar mutateAsync permite acompanhar cada conclusão independentemente.
- Falha de ativação/desativação tem feedback e permite repetir. Rejeições do
  formulário são tratadas, mantendo os valores e sem fechar em erro.
- Validação de limites PostgreSQL integer para duração/preço. Mantida conversão
  de euros para cêntimos com Math.round no submit.
- Diálogo nativo com nome acessível, Escape, foco modal, reposição do foco,
  scroll em ecrãs baixos e bloqueio do scroll da página.
- Migration `20260917000700_harden_services_updates.sql` aplicada em
  booking-saas-dev: trigger reutiliza private.set_updated_at(); grants por coluna
  tornam tenant/id/timestamps não editáveis e fecham explicitamente anon/DELETE.
  Sem novas tabelas ou alterações aos tipos de colunas existentes.

## Evidência

| Verificação | Resultado |
| --- | --- |
| npm test | 47 testes aprovados em 8 ficheiros; 23 novos testes de Services |
| npm run db:test:cloud | 92 testes SQL aprovados: onboarding 24, Services 39, tenant foundation 29 |
| npm run build | Aprovado, incluindo TypeScript strict |
| npm run lint | Aprovado |
| git diff --check | Aprovado |

Os testes de componentes usam React, TanStack Query e formulários reais com API
simulada. Verificam criação, edição, preenchimento, euros/cêntimos, recuperação
de erro, controlos por papel, invalidação e loading de dois serviços concorrentes.
Os testes API verificam filtros e mapeamento; os testes Zod verificam limites.

Os testes SQL correm na cloud com fixtures dentro de transações revertidas.
Comprovam criação/edição/ativação/desativação por owner/admin, leitura por employee,
bloqueio de escrita por employee, isolamento entre empresas, constraints,
updated_at e ausência de acesso anon/DELETE. Um manager de duas empresas também
não pode transferir serviços entre tenants.

Limites: API simulada nos testes React, sem percurso browser → Data API nesta
revisão. O diálogo é simulado em jsdom; o comportamento visual, foco nativo e
responsividade exigem smoke test num browser real. O build mantém o aviso de
chunk principal superior a 500 kB; não impede o build e fica para otimização futura.

## Smoke test visual a realizar

1. Owner/admin: criar serviço com descrição e preço decimal; editar e limpar
   descrição; confirmar catálogo atualizado e fecho do modal.
2. Alternar dois serviços rapidamente; observar cada botão até à sua conclusão.
3. Employee: consultar sem botões de escrita. Testar URL de empresa sem acesso.
4. Modal em viewport baixo e mobile: scroll, Tab/Shift+Tab, Escape e reposição do
   foco no botão que o abriu. Simular falha de rede e repetir sem perder valores.

## Próximo passo

Fase 6: definir o modelo employees e a associação employee/services, distinguindo
profissional com agenda de business_member. Definir RLS e testes de isolamento
antes da primeira migration; prever user_id opcional para uma futura ligação
Google por colaborador. O [design Calendar](google-calendar-architecture.md)
orienta as fases seguintes, sem as implementar agora.

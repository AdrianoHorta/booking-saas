# Testes automáticos de browser — cliente e equipa

## OBJECTIVE

Validar os percursos públicos e a agenda privada sem intervenção manual, credenciais Google ou
alterações na base de dados real. A configuração OAuth fica para uma etapa posterior.

## CONCEPTS

Playwright controla um browser real: navega, preenche campos, clica e verifica
o resultado. Mock de rede significa responder às chamadas HTTP com dados
controlados pelo teste. A aplicação usa os seus componentes, router, SDK Supabase
e validações reais; apenas a resposta do servidor é substituída.

## ARCHITECTURE

Chromium → build de produção servido por Vite preview → pedidos HTTP intercetados por Playwright.

O build de testes usa o modo `e2e`, escreve em `dist-e2e` e recebe variáveis de
ambiente fictícias com prioridade sobre `.env.local`. Não altera o build normal
em `dist`. O servidor usa a porta 4177 e não reutiliza um servidor já aberto. A fixture
permite apenas recursos locais e os RPCs simulados do domínio `.invalid`.
Pedidos externos inesperados são bloqueados e fazem falhar o teste. Service
workers estão desativados para não contornarem a interceção da rede.

O Vitest continua responsável pelos componentes, APIs e servidor. Os testes SQL
continuam responsáveis pelas regras e permissões reais. Estes testes de browser
não validam a entrega Realtime, OAuth real, SMTP nem a aplicação de RLS na cloud.

## IMPLEMENTATION PLAN

1. Instalar Playwright e Chromium; criar configuração isolada.
2. Simular os RPCs e bloquear outras chamadas externas.
3. Executar os percursos em desktop e em emulação móvel.
4. Guardar relatórios de falhas e instruções de repetição.

## WHAT WE BUILT

Seis cenários públicos, executados em dois formatos (12 testes):

1. Escolher serviço/profissional/vaga, rever, confirmar, abrir ligação privada,
   manter a reserva, cancelar explicitamente e confirmar o estado após reload.
2. Falhar a resposta à confirmação, recarregar a página e repetir exatamente o
   mesmo pedido, incluindo a chave de idempotência.
3. Receber um conflito de vaga ocupada: não mostrar sucesso e permitir nova seleção.
4. Prazo de cancelamento terminado: não apresentar a ação.
5. Prazo que termina depois de abrir a confirmação: mostrar o erro do servidor
   sem anunciar que a reserva foi cancelada.
6. Token rejeitado pelo servidor: não revelar dados da reserva.

Oito cenários da equipa, também em dois formatos (16 testes):

1. Proprietário seleciona Miguel/Ana, vê título e contactos correspondentes e
   filtra por estado; verificar os filtros enviados no pedido HTTP.
2. Colaborador vê a agenda individual, sem seletor de colegas nem campo de
   profissional redundante no card.
3. Conta sem profissional associado recebe orientação sem consultar reservas.
4. Reagendamento envia a referência, horário esperado e novo horário; após
   confirmação, o card atualiza mantendo preço e referência.
5. Conflito de vaga mantém o horário original e permite fechar a janela.
6. Servidor guarda o reagendamento mas perde-se a resposta: a janela bloqueia
   edição e Escape até repetir o mesmo pedido e confirmar o resultado.
7. Empresa sem acesso: não consultar reservas nem profissionais.
8. Visitante sem sessão: encaminhar para login sem pedidos de dados privados.

Seis cenários de membros e sessão, em dois formatos (12 testes):

1. Proprietário adiciona uma conta existente, promove-a a administrador e retira
   acesso após confirmação; cancelar a confirmação não emite o pedido de remoção.
2. Email sem conta registada mostra o erro sem inserir um membro na lista.
3. Administrador não pode promover contas nem alterar o proprietário ou a si próprio.
4. Colaborador não vê gestão de membros nem emite o RPC que devolve os emails.
5. Logout e login de outra conta no mesmo documento: esconder os dados anteriores,
   respeitar o papel da nova conta e manter a sessão terminada após reload.
6. Acesso de administrador retirado no servidor: ao regressar à página depois
   de a consulta ficar desatualizada, a revalidação mostra empresa indisponível
   e remove os dados de gestão da interface.

## HOW IT WORKS

Cada teste tem um contexto novo de browser, sem sessões ou dados de outros testes.
Os fixtures usam pessoas, endereços e identificadores fictícios. As datas futuras
fixas evitam dependência do calendário real; o limite temporal é comunicado pela
resposta simulada do servidor. Os testes SQL existentes verificam o cálculo real
do prazo de 12h/configurável, incluindo as fronteiras.

Os testes interagem por nome e papel acessível dos elementos, sem depender de
classes CSS. As verificações aguardam o estado esperado sem pausas arbitrárias.
O teste de recuperação compara os dois pedidos HTTP e verifica que o pedido
pendente é removido de sessionStorage apenas depois da confirmação.

Na área privada, `signIn` coloca uma sessão sintética no armazenamento do browser.
Não faz login real e o token não é válido num servidor Supabase. A fixture fornece
respostas HTTP para membership, profissionais e reservas. O relógio é fixado para
manter as datas reproduzíveis. A ligação WebSocket ao domínio fictício é encerrada
localmente; não se está a validar o protocolo nem a entrega Realtime nestes testes.

Os testes verificam a interface e os pedidos que envia. Não demonstram isolamento
RLS por si mesmos: é a suite SQL que verifica as permissões na base de dados real.
Os testes de sessão usam os formulários e botões reais com endpoints Auth
simulados. A sessão inicial é inserida uma única vez; um reload depois do logout
não restaura artificialmente a conta. Um marcador em memória verifica que o
percurso entre contas ocorreu no mesmo documento, sem reiniciar a aplicação.

A simulação de regresso à página propaga o evento `visibilitychange` até à janela,
como acontece no browser, permitindo a revalidação normal do TanStack Query.
Isto não garante remoção instantânea de dados ao revogar acesso remotamente:
verifica o que acontece na próxima consulta. A preservação das reservas após
remover um membro é responsabilidade dos testes SQL, não da resposta simulada.

Foram acrescentados cinco cenários, em desktop e mobile: cancelamento pela equipa
com confirmação e reload, repetição após resposta perdida, prazo rejeitado pelo
servidor, paginação com mudança de colaborador e logout noutra aba. Ainda falta
cobertura de alterações Realtime durante um formulário.

## FILES CHANGED

- `playwright.config.ts`: servidor dedicado, desktop/mobile, relatórios e traces.
- `e2e/fixtures.ts`: dados, intercetores HTTP, sessões sintéticas e isolamento de rede.
- `e2e/booking.spec.ts`: seis percursos do cliente.
- `e2e/team.spec.ts`: oito percursos da agenda privada e reagendamento.
- `e2e/members.spec.ts`: seis percursos de gestão de membros e sessão.
- `e2e/tsconfig.json`: verificação TypeScript dos testes e configuração.
- `vitest.config.ts`: mantém os testes Playwright fora da execução Vitest.
- `package.json` e `package-lock.json`: dependência e comandos.
- `.gitignore`: exclui relatórios e resultados gerados.
- `README.md` e este guia: documentação de execução e âmbito.

## IMPORTANT CODE

`context.route` substitui respostas antes de chegarem ao SDK Supabase. O domínio
fictício impede acesso acidental ao projeto real mesmo se faltar um mock.
`api.calls` permite verificar os pedidos emitidos pelo browser. `reuseExistingServer:
false` impede testar por engano contra uma instância com outra configuração.

Documentação oficial: [interceção de APIs](https://playwright.dev/docs/mock) e
[servidor de testes](https://playwright.dev/docs/test-webserver).

## GOOD PRACTICES USED

Contextos isolados, dados sintéticos, chamadas externas bloqueadas, testes de
sucesso e erro, validação de retries, execução headless e artefactos apenas locais.
A emulação móvel verifica o percurso numa viewport com toque; não substitui
testes em dispositivos físicos nem representa cobertura de Safari/Firefox.

## THINGS TO TEST

Validação da extensão de membros/sessão: 40 testes de browser aprovados (20 desktop +
20 mobile), lint e tipos dos testes aprovados. Na infraestrutura inicial passaram também
os 250 testes Vitest e o build. Esta extensão altera apenas testes e documentação;
não foram alteradas migrations nem repetidas suites SQL.

Não é necessária nenhuma ação manual agora. Para repetir posteriormente:

```powershell
npm ci
npx playwright install chromium
npm run test:e2e
```

`test:e2e` verifica também os tipos e inicia/termina o servidor automaticamente.
Em Linux CI, instalar dependências do browser com `npx playwright install --with-deps chromium`.

Para consultar o relatório HTML local:

```powershell
npm run test:e2e:report
```

Os diretórios `playwright-report/` e `test-results/` são gerados e ignorados pelo
Git. Nas falhas, ficam screenshot e trace para examinar o percurso e a rede.

## WHAT I LEARNED

Testar componentes isolados e testar o percurso no browser detetam problemas
diferentes. Uma interface pode estar correta em cada componente e ainda falhar
na navegação, na persistência após reload ou na tradução de erros HTTP.

## NEXT STEP

O [modo de demonstração](demo-mode.md) está implementado em `/demo`, com mais
8 testes de browser (percurso completo, isolamento, dados inválidos e navegação).
Foi acrescentada a [revisão de acessibilidade](accessibility.md), com seis
execuções adicionais de browser para login, reservas e teclado. A suite tem
agora 64 testes de browser e 255 testes Vitest após a extensão de fecho do MVP.
O workflow `.github/workflows/ci.yml` executa lint, Vitest, build e estes percursos
em cada push/PR, sem credenciais cloud. Ver a [checklist de publicação](release-checklist.md).
Validação de fecho: 62 passaram na execução geral; o logout entre abas passou
nos dois formatos após corrigir a navegação do teste. O teste de isolamento da
demo foi adaptado aos nomes dos bundles de produção e passou nos dois formatos
numa repetição dirigida. Não foi executada uma nova suite geral após esses ajustes.
A configuração e validação real do Google continuam pendentes até haver disponibilidade.

Na [fase 13](phase-13-integrations.md), a suite passou integralmente com 70 testes:
mais seis execuções para indicadores, ativação de emails, limites de permissão,
erros e acessibilidade. Google/Resend e o worker real não são acionados por estes testes.

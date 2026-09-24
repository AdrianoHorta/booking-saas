# Acessibilidade dos percursos reais

## OBJECTIVE

Verificar a utilização por teclado e em ecrãs estreitos, e detetar problemas
automáticos de acessibilidade nos percursos principais.

## CONCEPTS

O foco identifica o elemento que recebe o teclado. Os nomes e descrições
acessíveis permitem identificar controlos e associar erros aos campos.
Uma auditoria automática complementa testes de interação e avaliação manual.

## ARCHITECTURE

O hook `useConfirmationFocus` é partilhado pelas confirmações de cancelamento
do cliente e da equipa. Os testes Playwright usam as páginas reais com APIs
simuladas e executam axe-core apenas no ambiente de teste.

## IMPLEMENTATION PLAN

Auditar os estados carregados, reproduzir falhas de teclado, corrigir o foco e
validar os percursos em Chromium desktop e emulação móvel, a 320 px de largura.

## WHAT WE BUILT

Gestão de foco nas confirmações de cancelamento e seis novas execuções de
browser: três cenários em cada projeto (desktop/mobile).

## HOW IT WORKS

Ao abrir a confirmação, o foco passa para **Manter reserva**. Assim, um segundo
Enter não confirma involuntariamente o cancelamento. Ao desistir, regressa ao
botão **Cancelar reserva**. A primeira renderização não desloca o foco.
Quando um botão já não existe, por exemplo após cancelar, o hook não tenta focá-lo.

O diálogo de reagendamento mantém o comportamento nativo: foco inicial, Escape
e regresso ao botão de abertura. Os testes percorrem Tab e Shift+Tab e impedem
foco nos controlos de fundo. O browser pode levar o foco à sua própria interface;
isso não equivale a permitir interação com o conteúdo de fundo da página.

As auditorias cobrem login normal/com erros, revisão pública da reserva,
confirmação de cancelamento do cliente, agenda e diálogo de reagendamento.
Verificam também a ausência de overflow horizontal nesses estados.

## FILES CHANGED

- `src/components/ui/use-confirmation-focus.ts`: coordena foco nas transições.
- `src/features/booking/customer-booking-page.tsx`: aplica o hook no cliente.
- `src/features/reservations/cancel-reservation.tsx`: aplica o hook na equipa.
- `e2e/accessibility.ts`: executa axe-core e guarda o relatório no Playwright.
- `e2e/accessibility.spec.ts`: verifica login, foco e descrição dos erros.
- `e2e/booking.spec.ts` e `e2e/team.spec.ts`: verificam as reservas e o teclado.
- `package.json` e `package-lock.json`: dependência de desenvolvimento axe-core.
- README e documentação: cobertura e limites desta etapa.

## IMPORTANT CODE

O hook compara `previous.current` com `confirming` dentro de `useEffect`.
As refs apontam para os botões depois de o React atualizar a página; `focus()`
é chamado apenas numa mudança da confirmação, sem roubar foco ao abrir a página.

`AxeBuilder` verifica as regras etiquetadas WCAG 2 A/AA e 2.1 A/AA. Os resultados
integrais ficam anexados ao relatório, sem desativar regras para esconder falhas.
Referência: [documentação oficial Playwright](https://playwright.dev/docs/accessibility-testing).

## GOOD PRACTICES USED

Comportamento partilhado, foco na opção não destrutiva, controlos HTML nativos,
dados sintéticos e testes do comportamento real no browser.

## THINGS TO TEST

Executar `npm run test:e2e` ou `npx playwright test --grep acessibilidade`.
Os testes automáticos não certificam conformidade WCAG completa. Quando houver
disponibilidade, testar leitor de ecrã, zoom, Safari/Firefox e telemóvel físico.
As integrações reais e restantes páginas não ficam validadas por esta auditoria.

## WHAT I LEARNED

Uma página pode passar uma auditoria automática e ainda perder o foco ao trocar
botões. Os testes de teclado permitem descobrir e prevenir esse problema.

## NEXT STEP

Alargar a cobertura de browser à gestão de serviços, colaboradores e horários,
mantendo as configurações externas de Google e email para mais tarde.

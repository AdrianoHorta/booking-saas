# Publicação

## Revisão de 28 de setembro de 2026

A interface pública apresenta o produto e as funcionalidades disponíveis. Foram
retirados o roteiro de desenvolvimento, as chamadas para demonstração e o email
redundante no painel. O email de acesso continua disponível no perfil pessoal.

`/features` apresenta as funcionalidades; `/project` encaminha para essa página.
`/demo` e `/demo/` encaminham para `/`. O código de demonstração não é incluído
no build. Os testes e registos técnicos históricos permanecem no repositório.

## Publicar o frontend

1. Executar `npm run lint`, `npm test`, `npm run build` e `npm run test:e2e`.
2. No projeto Vercel pretendido, usar Node.js 24 e definir `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_PUBLISHABLE_KEY` do destino correto antes do build.
3. Publicar a revisão validada. `vercel.json` configura `npm run build`, saída
   `dist`, fallback SPA e headers de segurança.
4. Abrir `/`, `/features`, `/register` e `/login` no domínio final, incluindo
   navegação direta e reload. Confirmar também os redirects de `/project` e `/demo`.
5. Com uma conta e empresa autorizadas, verificar `/dashboard`, `/account`,
   `/book/:slug` e a ligação privada de uma reserva em desktop e telemóvel.

## Serviços reais

A preparação visual não substitui a validação das configurações remotas.
O ambiente documentado anteriormente era `booking-saas-dev`; confirmar o destino
pretendido antes de alterar a base ou as definições de autenticação.

- [x] Migrations 027 e 028 aplicadas no projeto ligado `booking-saas-dev` em
  28 de setembro, corrigindo a ausência dos perfis e do armazenamento de imagens.
  Confirmar migrations novamente se o frontend apontar para outro destino.
- [ ] Confirmar Site URL e redirects de Auth para o domínio final:
  `/auth/callback` e `/reset-password`.
- [ ] Configurar e validar SMTP, confirmação de email e recuperação de password.
  O ambiente de desenvolvimento documentado tinha confirmação de email desativada.
- [ ] Verificar um percurso real de registo, login, recuperação, edição de perfil,
  criação de empresa, serviços, equipa, horários e publicação das reservas.
- [ ] Verificar reserva, reagendamento pela equipa, cancelamento pelo cliente e
  atualização da agenda entre duas sessões.
- [ ] Antes de ativar emails de reservas, confirmar domínio/credenciais Resend,
  origem da aplicação e worker; verificar a receção de uma mensagem real.

Google Calendar permanece desativado na interface. Reativar apenas depois de
configurar OAuth e verificar o ciclo de ligação e sincronização real. Ver
[integrações](phase-13-integrations.md) e [Google Calendar](phase-12a.md).

Migrations e Edge Functions são publicadas separadamente. Não executar os testes
SQL ou de concorrência sobre uma base com dados reais.

## Limites da validação local

Validação desta revisão: lint e build aprovados; 280 testes Vitest aprovados com
`node node_modules/vitest/vitest.mjs run --maxWorkers=2`; 80 testes Playwright
aprovados em desktop e mobile, incluindo verificações de acessibilidade.
A execução Vitest com concorrência automática excedeu o tempo de espera num
teste de serviços; o teste isolado e a suite completa com dois workers passaram.
As capturas das páginas inicial e de funcionalidades foram revistas nos dois
formatos. Não foi efetuado deploy do frontend. Posteriormente, as migrations
027 e 028 foram aplicadas no Supabase para corrigir o carregamento do perfil.

Playwright usa APIs simuladas em Chromium, em desktop e emulação móvel. Não
comprova redirects da Vercel, entrega de emails, OAuth, Realtime remoto ou regras
RLS na base publicada. Estes pontos exigem verificação no domínio e ambiente final.

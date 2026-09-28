# Fase 12.x A — Ligação Google Calendar por colaborador

Atualização: a [fase 13](phase-13-integrations.md) acrescenta sincronização de
eventos. A configuração atual exige também o scope
`https://www.googleapis.com/auth/calendar.events`. As descrições abaixo de
“apenas leitura” referem-se à primeira implementação desta fase.

## OBJECTIVE

Cada colaborador associado a uma conta pode autorizar o Google e escolher um
calendário. Código implementado; ativação OAuth e validação com conta real pendentes.
A migration e a Edge Function estão instaladas em booking-saas-dev. Os quatro
segredos Calendar ainda não estão configurados (presença dos nomes verificada).

## CONCEPTS

OAuth dá acesso limitado a outro serviço sem pedir a palavra-passe. O código de
autorização é trocado pelo servidor. O access token é temporário; o refresh token
permite renovar esse acesso. O state liga o retorno a uma tentativa legítima.

## ARCHITECTURE

React → Edge Function → Google e RPCs privadas de servidor.

O login na aplicação continua separado da conta Google. `auth.getUser` verifica
a sessão; a função SQL encontra o colaborador ativo pela conta e empresa, em vez
de aceitar um employee_id fornecido pelo browser. Só essa pessoa pode ligar o
calendário, mesmo que outro utilizador seja owner/admin.

O state é aleatório, com hash ligado à origem e ao session_id verificado. Expira
em 10 minutos e é consumido uma única vez. O browser também compara o state com
sessionStorage e a identidade atual. O callback remove o código do histórico e
pede confirmação antes da troca server-side. Supabase Auth não interpreta este
callback como um login. A página aplica Referrer-Policy no-referrer via meta.

O refresh token fica cifrado com AES-GCM, IV aleatório e chave apenas nos secrets
da Edge Function. O access token só existe temporariamente na função. A tabela
de credenciais não concede acesso a anon/authenticated. O RPC de estado devolve
apenas o profissional, existência da ligação e calendário escolhido.

## IMPLEMENTATION PLAN

1. Tabela e RPCs restritas; invalidação ao reassociar/inativar colaborador.
2. Servidor de autorização, renovação, listagem, seleção e revogação.
3. Card na empresa e página de callback.
4. Testes SQL, servidor e interface; configuração externa documentada.

## WHAT WE BUILT

Ligar, voltar a autorizar, listar calendários com acesso writer/owner, guardar a
seleção e desligar com confirmação. Pedimos apenas `openid` e
`https://www.googleapis.com/auth/calendar.calendarlist.readonly`.
Esta fase não cria eventos nem usa calendários externos para bloquear vagas.
Na fase B será necessário novo consentimento para escrever eventos.

## HOW IT WORKS

O servidor fixa os endereços Google e aceita apenas origens configuradas. O Google
devolve o código à app; esta envia-o com a sessão atual à Edge Function. Depois
de consumir o state, o servidor troca o código, valida o scope e identifica a
conta via userinfo. Se faltar refresh token, só reutiliza o anterior quando a
identidade Google é a mesma. Mudar de conta exige token novo e nova escolha de
calendário. Nunca se reaproveita um token de outra identidade.

Cada operação grava com uma versão esperada, evitando que respostas antigas
substituam uma ligação entretanto alterada. Ao selecionar, o servidor volta a
consultar o Google e valida que o calendário pertence à lista com escrita. A
listagem trata paginação. Falhas de renovação pedem nova autorização.

Desligar revoga primeiro no Google e elimina depois o segredo local. Uma falha
remota preserva o segredo cifrado para permitir repetir. A remoção/reassociação
do colaborador apaga as credenciais locais imediatamente; não executa uma
revogação HTTP dentro da transação SQL. Nessa situação, a pessoa pode remover a
autorização nas definições da conta Google. Não há jobs nem eventos nesta fase.

## FILES CHANGED

- `supabase/migrations/20260922002400_calendar_connections.sql`: persistência, RPCs e isolamento.
- `supabase/functions/google-calendar/index.ts`: entrada Deno.
- `supabase/functions/google-calendar/handler.ts`: OAuth e chamadas Google.
- `supabase/functions/google-calendar/crypto.ts`: cifra e hash.
- `supabase/functions/.env.example`: nomes das variáveis de servidor.
- `supabase/config.toml`: JWT validado dentro da função com getUser.
- `src/features/calendar/calendar-api.ts`: chamadas e validação das respostas.
- `src/features/calendar/calendar-settings.tsx`: interface do colaborador.
- `src/features/calendar/calendar-callback-page.tsx`: retorno e confirmação.
- `src/app/router.tsx`, `business-page.tsx`: integração na navegação e empresa.
- `src/lib/supabase/client.ts`, `index.html`: separação do callback e referrer.
- `src/lib/supabase/database.types.ts`: tipos regenerados.
- Testes SQL, crypto, handler e interface; README e documentação.

## IMPORTANT CODE

`calendar_connection_backend` é executável apenas por service_role. Os locks e
`version` validam a associação também no momento da escrita. `consume` apaga o
state antes de contactar o Google. Um erro após esse ponto exige uma nova
autorização; a interface sugere consultar primeiro o estado se houver dúvida.

`seal` cifra e autentica o conteúdo; alterar o ciphertext ou usar outra chave
impede a leitura. Guardar só o hash do state reduz a exposição de autorizações
temporárias numa leitura indevida da base de dados.

## GOOD PRACTICES USED

Menor privilégio, consentimento explícito, state de uso único, sessão verificada,
origens fixas, dados cifrados, nenhum segredo no frontend, erros sem tokens ou
respostas brutas do fornecedor e proteção contra operações concorrentes.

## THINGS TO TEST

Validação automática: 647 testes SQL; 250 testes frontend/servidor (suite geral e
repetição dirigida após corrigir a espera assíncrona em dois testes de UI).
Build, lint e `deno check` aprovados. A suite Google simula as respostas HTTP;
não houve consentimento ou acesso a um calendário real. Sem deploy Vercel nesta etapa.

Depois da configuração abaixo:

1. Entrar com uma conta associada a um colaborador ativo; ligar Google.
2. Recusar consentimento e confirmar uma mensagem recuperável.
3. Autorizar, concluir ligação e escolher um calendário.
4. Recarregar a empresa e confirmar que a escolha se mantém.
5. Testar outra conta/empresa: não pode consultar nem gerir a ligação anterior.
6. Revogar na conta Google: a app deve pedir nova autorização ao consultar calendários.
7. Desligar pela app e verificar que o estado fica desligado.
8. Reabrir um callback usado/expirado: a ligação não deve ser repetida.

## Configuração para testar agora

1. No Google Cloud, criar/escolher um projeto e ativar **Google Calendar API**.
2. Em Google Auth Platform, configurar branding, audiência e utilizadores de
   teste. Adicionar a conta Google com que vais testar. Configurar `openid`,
   `https://www.googleapis.com/auth/calendar.calendarlist.readonly` e
   `https://www.googleapis.com/auth/calendar.events`. Ver [consentimento e scopes](https://developers.google.com/workspace/guides/configure-oauth-consent).
3. Criar um cliente OAuth do tipo **Web application**. Adicionar como redirect:
   `http://localhost:5173/calendar/callback`. Se usares outro porto ou o site
   Vercel, adicionar também o endereço exato dessa origem seguido de
   `/calendar/callback`, sem barra final. Este callback é da aplicação, não o
   callback de login Supabase. Ver [OAuth de servidor](https://developers.google.com/identity/protocols/oauth2/web-server).
4. Copiar `supabase/functions/.env.example` para `.env.calendar.local` e preencher
   client ID e client secret. Este ficheiro está ignorado pelo Git. Configurar
   `CALENDAR_APP_ORIGINS` com origens exatas, sem barra final, separadas por vírgula.
5. A chave já foi instalada no projeto ligado durante o diagnóstico localhost.
   Preservar esse valor. Apenas num projeto sem chave, gerar uma vez e colocar o resultado em
   `CALENDAR_ENCRYPTION_KEY` (não enviar na conversa):

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

6. Enviar os segredos ao projeto de desenvolvimento:

   ```powershell
   $env:SUPABASE_TELEMETRY_DISABLED='1'
   npx supabase secrets set --env-file .env.calendar.local --project-ref ztldgxngubtprderwssw
   ```

   Em alternativa, guardar os quatro valores no Dashboard → Edge Function
   Secrets. Seguir o [guia Supabase](https://supabase.com/docs/guides/functions/secrets).
   Não usar `VITE_*` nem guardar o segredo Google nas variáveis públicas Vercel.
7. Executar `npm run dev`, abrir a empresa e usar **O meu Google Calendar**.

Preservar a chave de cifra: trocá-la sem recifrar os dados impede ler os tokens
existentes. Antes de publicar para utilizadores externos, rever os requisitos de
consentimento/verificação do Google. Revogar uma conta Google pode exigir nova
autorização noutras ligações da mesma conta a esta aplicação.

## WHAT I LEARNED

A conta da aplicação identifica quem pode gerir o colaborador; a autorização
Google permite ao servidor aceder apenas às operações consentidas. Um ID de
calendário enviado pelo frontend não prova acesso a esse calendário.

## NEXT STEP

Configurar OAuth e validar o percurso real. Depois, fase B: outbox transacional,
worker e criação idempotente dos eventos após confirmar reservas.

# Fase 3 — Autenticação

**Modo atual de desenvolvimento:** confirmação de email desativada no
booking-saas-dev, com sessão imediata no registo. Ver [configuração dev](development-auth.md).
As instruções de confirmação abaixo descrevem o modo a reativar no lançamento.

## O que foi implementado

- `/register`: criar conta e pedir confirmação de email.
- `/login`: entrar com email/password.
- `/forgot-password`: pedir email de recuperação.
- `/reset-password`: alterar password com sessão válida.
- `/auth/callback`: receber confirmação de email.
- `/dashboard`: página privada inicial com email e logout.

Esta área privada é uma base para a fase 4, não o dashboard de reservas.
Não foram alteradas as migrations ou abertas permissões de escrita nas tabelas.

## Fluxo de dados

```text
Formulário → React Hook Form → schema Zod → auth-api → Supabase Auth
                                                       ↓
Interface ← useAuth ← AuthProvider ← onAuthStateChange
```

React Hook Form gere os valores, erros de campo e estado de submissão. O resolver
executa Zod antes da chamada remota. Os schemas definem tipos com `z.infer`,
evitando manter uma interface manual separada para os mesmos campos.

TypeScript não valida pedidos de terceiros. O Supabase valida credenciais,
tokens e a política de password no servidor. O mínimo de oito caracteres deve
ser configurado também no Dashboard: a regra Zod não altera essa política.

## Ficheiros e responsabilidades

- `src/lib/env.ts`: valida URL HTTPS e uma chave publishable. Rejeita chaves secret.
- `src/lib/supabase/client.ts`: cliente único, tipado com Database gerado do schema.
- `features/auth/api/auth-api.ts`: chamadas de login, registo, recuperação, atualização e logout.
- `features/auth/auth-provider.tsx`: sessão, carregamento, erros e limpeza da subscrição.
- `features/auth/auth-context.ts`: contrato do contexto e hook useAuth.
- `features/auth/auth-errors.ts`: mensagens seguras e compreensíveis em português.
- `features/auth/schemas`: regras de formulário e testes.
- `features/auth/pages`: composição das páginas e feedback da submissão.
- `features/auth/components`: layout de autenticação e proteção de rotas.
- `components/ui`: Button e FormField reutilizáveis, com labels e erros associados.

## Sessão

O SDK persiste e renova a sessão. Não guardamos passwords em localStorage.
Os tokens de sessão são geridos pelo SDK no browser; não são uma cookie HttpOnly.
Não adicionar HTML arbitrário, scripts não confiáveis ou logs de sessão.

O provider subscreve primeiro os eventos e depois consulta a sessão inicial.
Uma resposta inicial tardia não pode substituir um evento mais recente.
A callback dos eventos é síncrona: não faz novas chamadas Auth enquanto o SDK
está a processar a mudança. Ao desmontar, a subscrição é removida.

ProtectedRoute mostra carregamento antes de decidir se redireciona para login.
Essa proteção melhora a experiência, mas não substitui RLS. getSession fornece
estado à interface; a base de dados continua a verificar o token e as policies.

Logout usa scope local: termina a sessão atual, sem prometer terminar sessões
noutros dispositivos. O estado muda através do evento do SDK.

## Confirmação e recuperação

Usamos o fluxo implicit suportado pelo SDK para esta SPA. O Supabase devolve
tokens no fragmento do URL; o SDK processa-os e limpa o fragmento. O fluxo PKCE
é uma alternativa, particularmente relevante se migrarmos para SSR.

O callback de confirmação aguarda a sessão antes de abrir a área privada.
Links com erro explícito mostram uma mensagem, mesmo que exista uma sessão antiga.
Erros de links são capturados antes de o SDK alterar o URL; não exibimos o texto
recebido no link como HTML nem registamos os tokens.

A recuperação devolve uma mensagem neutra para não revelar se existe uma conta.
A página de nova password exige sessão; um utilizador já autenticado também
pode utilizá-la. Um link expirado mostra a opção de pedir outro.
Depois de atualizar a password, a sessão atual permanece ativa.

## Configuração cloud necessária

Em Authentication → URL Configuration, permitir exatamente:

```text
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
http://127.0.0.1:5173/auth/callback
http://127.0.0.1:5173/reset-password
```

Site URL de desenvolvimento: `http://localhost:5173`.
Manter email/password e confirmação de email ativos; mínimo de password: 8.
O SDK usa a origem atual ao construir redirects. Ao publicar, acrescentar os
endereços HTTPS reais e mudar Site URL para o domínio publicado.

O serviço de email predefinido do Supabase tem restrições de destinatários e
limites de envio. Para testes abertos a recrutadores será necessário configurar
SMTP apropriado. Não desativar confirmação só para contornar essas restrições.

## Validação realizada

- 12 testes Vitest: schemas, mensagens de erro e configuração pública.
- Browser com Supabase real: credenciais inválidas rejeitadas e mensagem traduzida.
- Configuração pública cloud: email ativo, registo ativo e confirmação obrigatória.
- Browser: redirecionamento sem sessão, campos inválidos, reset sem sessão,
  callback expirado e layout de registo a 390 px sem transbordamento horizontal.
- Respostas Auth simuladas: login, persistência após refresh, atualização de
  password e logout, incluindo novo refresh. Não demonstram entrega real de emails.

## Teste manual pendente

1. Confirmar URLs e mínimo de password no Dashboard.
2. Abrir `/register`, usar um email autorizado pelo serviço de envio e confirmar
   o email. Deve abrir a área privada.
3. Fazer refresh e verificar que a sessão permanece.
4. Terminar sessão e tentar abrir `/dashboard` diretamente.
5. Entrar de novo; pedir recuperação e seguir o email.
6. Alterar a password, sair e entrar com a nova password.
7. Confirmar que links inválidos ou expirados apresentam feedback.

Usar `npm test`, `npm run lint` e `npm run build` para as verificações locais.

## Decisões e limites

As páginas de formulário usam lazy loading para separar React Hook Form/Zod
da página inicial. Não precisamos de TanStack Query para substituir a gestão
de sessão que o SDK já fornece; será introduzido nas consultas das empresas.
Não existe Google OAuth, criação de empresa ou gestão de convites nesta etapa.

Exercício: segue uma submissão de login do schema até ao evento de sessão e
explica porque o componente não precisa de guardar uma segunda cópia do utilizador.

Commit sugerido: `feat: add Supabase authentication flows`.

Referências:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- https://supabase.com/docs/guides/auth/auth-smtp

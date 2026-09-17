# Autenticação durante o desenvolvimento

No projeto `booking-saas-dev` (`ztldgxngubtprderwssw`), a confirmação de email
está desativada temporariamente. O registo devolve uma sessão e permite entrar
imediatamente com email/password, sem depender de uma caixa de correio.

Podem ser usadas contas fictícias com formato válido, por exemplo
`admin@example.com` e `barber@example.com`. O endereço não atribui permissões:
owner/admin/employee continuam a depender de business_members.

## Configuração aplicada

`supabase/environments/development/supabase/config.toml` declara apenas
`auth.email.enable_confirmations = false`. A diferença foi revista antes do push;
as restantes propriedades cloud não foram alteradas.

O frontend suporta os dois modos: se signUp devolver sessão, abre a área privada;
se não devolver, apresenta instruções de confirmação. Não existe um bypass local
de autenticação e as policies RLS mantêm-se.

Verificação real concluída: registo com sessão imediata, logout e novo login.
A conta temporária usada na verificação foi removida.

## Limites dos testes

- A password continua obrigatória e sujeita à política do Supabase.
- Recuperar a password por email continua a exigir uma caixa de correio acessível.
- Contas anteriores que ficaram pendentes podem precisar de tratamento separado.
- Não foram criadas contas com os endereços de exemplo do utilizador.

## Antes do lançamento

Ativar Confirm email no projeto de produção e configurar SMTP e redirects reais.
Não aplicar a configuração de desenvolvimento nesse projeto.

Se também quisermos reativar no projeto dev, mudar o valor deste ficheiro para
true, rever com config diff e aplicar ao mesmo project ref, ou mudar no Dashboard
e manter o ficheiro coerente.

Reativar confirmação só afeta os novos registos: não verifica retroativamente
as contas auto-confirmadas. As contas fictícias devem permanecer no projeto dev,
separado do projeto de produção.

Confirmar email comprova acesso à caixa de correio nesse momento, não a identidade
real da pessoa. A autorização continua a ser uma responsabilidade independente.

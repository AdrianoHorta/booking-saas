# Perfil, empresa e imagens

`/account` permite editar o nome pessoal, enviar/remover uma fotografia, pedir
alteração do email e mudar a password. A página de negócios usa cartões com o
logótipo e o papel na empresa, e dá acesso direto ao perfil. O menu autenticado
também inclui **O meu perfil**.

Em **Empresa → Definições → Identidade da empresa**, apenas o proprietário pode
editar nome, descrição, contactos, morada e logótipo. O slug e o fuso horário
mantêm-se; alterar o nome não invalida as ligações públicas existentes.

## Dados e permissões

- `user_profiles` contém nome pessoal e caminho da fotografia. Cada conta só
  pode ler o seu perfil. As operações de escrita obtêm a identidade de `auth.uid()`.
- A fotografia aparece no catálogo público apenas através da conta associada a
  um profissional ativo. Desassociar a conta remove essa associação pública.
  O nome profissional continua a ser gerido na equipa, independentemente do nome pessoal.
- O bucket público `brand-images` aceita imagens até 5 MB. RLS limita uploads e
  remoções à pasta do próprio utilizador ou às empresas de que é proprietário.
  Não há permissão para sobrescrever objetos; cada upload recebe um UUID.
- O browser aceita JPG, PNG e WebP, descodifica a imagem e exporta WebP com até
  768 px no lado maior. O ficheiro original e os seus metadados não são enviados.
- O utilizador vê a pré-visualização antes de guardar e é informado de que a imagem
  será pública. Sem imagem ou se o carregamento falhar, aparecem as iniciais.
- Só depois da referência ser guardada se tenta remover a imagem anterior. Uma
  falha de rede ambígua conserva os ficheiros: pode deixar uploads órfãos para
  limpeza posterior. A remoção do Storage é feita pela API, nunca por SQL direto.
- A aplicação nunca grava passwords em tabelas, metadados ou caches de mutations.

## Publicação

Aplicar as migrations 027 e 028, pela ordem habitual, e publicar o frontend.
A migration 028 cria o bucket, as policies, a tabela e os RPCs, e acrescenta a
fotografia ao catálogo. Não é necessário criar o bucket manualmente. Logos antigos
por URL HTTPS continuam a ser apresentados; uploads novos usam caminhos do bucket.

Email/password usam [Supabase Auth updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser).
A alteração de email mostra o endereço atual e o pedido pendente, sem anunciar a
mudança como concluída antes da resposta do servidor. O redirect usa `/auth/callback`,
que deve estar autorizado para o domínio publicado. O envio real depende do SMTP
e da configuração de confirmação de email do projeto.

A password atual é enviada como `current_password`; a sua verificação pelo
servidor exige a opção **Require current password when changing password**.
Se **Secure password change** exigir reautenticação, o formulário permite pedir
um código e enviá-lo como `nonce`. Estas opções Auth não são alteradas pela migration.
Ver [segurança de passwords](https://supabase.com/docs/guides/auth/password-security).

## Validação

Testes SQL cobrem isolamento, permissões de Storage, proprietário vs. outros
papéis, referências inválidas e exposição pública limitada. A migration e a suite
foram executadas em conjunto com rollback em `booking-saas-dev`, sem publicação.
Playwright usa contas, Auth e Storage simulados para testar edição, upload,
remoção, confirmação de email e reautenticação em desktop/mobile. Os testes não
alteram passwords reais nem enviam emails reais.

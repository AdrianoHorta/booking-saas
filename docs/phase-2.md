# Fase 2A — Fundação Supabase e multiempresa

## Estado

CLI ligada a booking-saas-dev. Duas migrations aplicadas na cloud e 29 testes
pgTAP aprovados, sem Docker. Histórico local e remoto sincronizados.
Segue o [guia cloud](supabase-cloud.md) para os passos de configuração.

Os tipos reais foram gerados em src/lib/supabase/database.types.ts.
A integração frontend foi acrescentada na [fase 3](phase-3.md).

## Porque começamos com duas tabelas

Todas as entidades futuras precisam de pertencer a uma empresa. Começamos por
esta relação para testar o isolamento antes de acrescentar serviços e reservas.
Esta é a fundação do modelo, não o schema completo do produto.

```text
auth.users 1 ── N business_members N ── 1 businesses
```

`auth.users` pertence ao Supabase Auth. Não criamos outra tabela de passwords.
`businesses` guarda nome, slug, descrição, contactos, caminho do logótipo,
timezone, moeda, intervalo entre slots, estado e timestamps.
`business_members` liga empresa e conta, com role owner/admin/employee.

Um membro é alguém com acesso ao sistema. Um colaborador com agenda será
representado noutra tabela, podendo existir sem conta.

## Migrations

`20260917000100_create_tenant_foundation.sql` cria tabelas, tipos, constraints,
índices e triggers. Ativa imediatamente RLS e retira os privilégios dos clientes.

`20260917000200_add_tenant_read_policies.sql` permite apenas a leitura autorizada.
Não existem operações de escrita para o frontend nesta etapa.

Cada migration é aplicada uma vez e registada no histórico. Depois de aplicada
num ambiente partilhado, alterações devem ser novas migrations, não edições
retroativas. Um ficheiro com data ordena a execução; não é um agendamento.

## Constraints e decisões

- `id uuid`: identificador independente do nome ou slug.
- `slug unique`: impede dois endereços públicos iguais. Apenas minúsculas,
  números e hífen entre palavras, de 3 a 63 caracteres.
- Nome: entre 2 e 120 caracteres úteis, rejeitando nomes só com espaços.
- `primary key (business_id, user_id)`: impede associações duplicadas.
- `business_role`: enum com os três papéis permitidos.
- `user_id references auth.users`: não permite membros sem conta existente.
- `on delete restrict` na conta: evita remover silenciosamente membros ao
  apagar um utilizador. A futura operação de eliminação terá de tratar a propriedade.
- `on delete cascade` na empresa: se uma operação autorizada apagar uma empresa,
  apaga também as suas associações. O frontend ainda não pode fazer isso.
- Moeda limitada a EUR no MVP. Outras moedas requerem uma migration explícita.
- Intervalo de slots entre 5 e 120 minutos, em múltiplos de cinco. Não representa
  a duração do serviço, que será um campo independente.
- Timezone validada contra os nomes reconhecidos pelo PostgreSQL.
- Contactos têm limites de tamanho; validação de formato será adicionada à
  operação de configuração e ao formulário. Não tratamos estes limites como
  uma validação completa de email ou telefone.

`logo_path` será um caminho de Storage, não uma credencial nem uma signed URL
que expire. Nenhum bucket é criado nesta etapa.

## Índices e triggers

A chave primária de membros já cria um índice começado por empresa. O índice
`(user_id, business_id)` facilita descobrir as empresas de um utilizador.
`unique` no slug também cria um índice. Não duplicamos esses índices.

Um trigger executa uma função em resposta a uma alteração da tabela.
`set_updated_at` atualiza o timestamp; `validate_business_timezone` rejeita
timezones desconhecidas em inserções ou alterações desse campo.

## Autorização: grants mais RLS

Um grant permite tentar uma operação sobre a tabela. RLS decide quais as linhas
visíveis. O resultado depende das duas camadas.

| Identidade | Empresas | Membros | Escrita direta |
| --- | --- | --- | --- |
| Anónimo | Sem acesso | Sem acesso | Sem acesso |
| Autenticado sem associação | Nenhuma linha | Nenhuma linha | Sem acesso |
| Employee | Empresas a que pertence | As próprias associações | Sem acesso |
| Owner/Admin | Empresas a que pertence | Membros dessas empresas | Sem acesso |

Uma empresa inativa continua visível aos seus membros para administração.
O catálogo público futuro terá de verificar separadamente o estado ativo.

`private.has_business_role` consulta a associação usando `auth.uid()`. Não aceita
um utilizador enviado pelo browser. É `security definer` para consultar a tabela
de membros sem voltar a executar a própria policy recursivamente.

Essa exceção tem limites: não escreve, devolve apenas um booleano, fixa
`search_path = ''`, qualifica os nomes das tabelas e só dá permissão de execução
a `authenticated`. O schema `private` não está na lista de schemas da Data API.

Não usamos RLS como única proteção para operações privilegiadas. A fase 4
implementará a criação de empresa + owner numa transação e operações específicas
para membros, incluindo proteção do último proprietário. Essas operações ainda
não existem; utilizadores não podem criar empresas nesta etapa.

## Como aplicar na cloud

Depois de criar o projeto e autenticar/ligar a CLI conforme o guia cloud:

```sh
npm run db:plan
npm run db:push
npm run db:history
```

A pré-visualização mostra migrations pendentes, mas não executa nem valida SQL.
O push aplica-as e regista o histórico remoto. Não usamos reset nem seed automático.
config.toml permanece como configuração local opcional. Auth cloud é configurado
no Dashboard e não é alterado automaticamente por este ficheiro.

## Como funcionam os testes

Executar `npm run db:test:cloud`. O script usa `supabase db query --linked`
e interpreta o resultado de finish() do pgTAP, rejeitando diagnósticos de falha.
Foi validado também com uma asserção deliberadamente falsa. Está limitado ao
identificador de booking-saas-dev para evitar execução acidental noutro projeto.
A consulta em supabase/checks/tenant-security.sql verifica apenas metadados.

`supabase/tests/database/tenant_foundation.test.sql` usa pgTAP, uma biblioteca de
asserções SQL. `is` compara valores, `ok` verifica uma condição e `throws_ok`
confirma que uma operação falha com o código SQL esperado.

O teste cria utilizadores fictícios e empresas como administrador. Depois muda
para `authenticated` ou `anon` e define a identidade da sessão simulada. As
consultas avaliadas têm as permissões reais desses papéis, em vez de usar sempre
um administrador que contorna RLS.

Verificamos isolamento, filtros explícitos para outra empresa, múltiplas
associações, leitura por papel, proibição de escrita e constraints. A transação
termina com `rollback`, por isso os dados de teste não ficam na aplicação.
Alterar claims manualmente aqui é uma capacidade da sessão SQL de testes, não
uma funcionalidade dada ao browser.

Os testes ainda não cobrem Auth por HTTP, concorrência de reservas ou onboarding;
essas funcionalidades serão implementadas e verificadas nas respetivas fases.

## Variáveis e tipos

O `.env.example` apresenta nomes públicos com valores vazios, consumidos pelo
cliente implementado na fase 3. Chaves secret/service_role nunca pertencem
a variáveis VITE_. Não é necessário enviar credenciais para esta conversa.

Os tipos foram gerados pela CLI a partir da base remota. `npm run db:types`
permite gerar novamente após alterações ao schema; imprime o resultado no terminal.

## Exercício

Lê a policy de membros e procura as duas alternativas do `or`: quem pode ver
a sua própria associação e quem pode consultar a equipa? Depois localiza o teste
que mostra Alice em duas empresas com papéis diferentes.

Commit sugerido, após validar os testes:
`feat: add Supabase tenant foundation and read policies`.

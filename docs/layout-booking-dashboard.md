# Reservas e dashboard — 28 de setembro de 2026

A página `/book/:slug` usa uma caixa centrada com seis passos: serviço,
profissional, dia, hora, contactos e revisão. A seleção do serviço/profissional
limpa as escolhas dependentes; mudar de dia limpa o horário. Os contactos
mantêm-se ao voltar atrás. A confirmação e a recuperação de pedidos continuam
a usar o contrato existente, incluindo a chave de idempotência.

O calendário usa o dia local da empresa e consulta as vagas apenas após escolher
uma data. Os dias futuros não implicam disponibilidade: só os horários devolvidos
pelo servidor podem ser selecionados. Preços, duração e profissionais vêm do
catálogo público; a confirmação final continua a validar a vaga no servidor.

O cabeçalho apresenta o nome e o logótipo da empresa. A migration
`20260928002700_public_booking_branding.sql` acrescenta o campo existente
`businesses.logo_path` à resposta pública, preservando os filtros de publicação.
O campo aceita um URL HTTPS público ou um caminho do bucket `brand-images`.
Sem imagem, ou se falhar, aparecem as iniciais da empresa. O upload pelo
proprietário e a fotografia pessoal foram acrescentados na migration 028 e na
[área de perfis](profiles-and-images.md). O catálogo anterior continua compatível.

O dashboard tem cartões para as tarefas e duas secções: **Visão geral** e
**Definições** (`?view=settings`). Publicação, prazo de cancelamento e acessos
ficam nas definições; permissões existentes mantêm-se. Google Calendar continua
desativado.

Publicação: aplicar a migration no Supabase pretendido e publicar o frontend.
As alterações desta etapa não foram publicadas automaticamente.

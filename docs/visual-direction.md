# Direção visual — fase 1.1

## Intenção

Uma identidade formal, serena e elegante, com cores quentes e destaque no laranja.
Esta direção substitui a apresentação inicial de cartões verdes.

## Paleta

| Token | Cor | Papel |
| --- | --- | --- |
| canvas | `#faf6ef` | Fundo marfim |
| surface | `#fffcf7` | Superfícies claras |
| ink | `#35291f` | Texto castanho escuro |
| muted | `#766352` | Texto secundário |
| brand | `#a34623` | Laranja queimado para ações e destaques |
| brand-soft | `#f3e4d5` | Fundos quentes suaves |
| apricot | `#edc5a0` | Ilustração decorativa |

Os tons claros ocupam as grandes superfícies; o laranja mais escuro permite
destacar texto e ações sem depender de um laranja vivo com baixo contraste.

## Tipografia

Títulos: Palatino Linotype, Book Antiqua, Palatino ou Georgia, conforme as fontes
disponíveis no dispositivo. Texto e controlos: Segoe UI, Helvetica Neue ou sans-serif.
São fontes do sistema, sem downloads externos. A renderização varia entre sistemas;
uma fonte alojada localmente poderá uniformizar a identidade numa próxima revisão.

A serifada e o itálico são usados nos títulos e detalhes editoriais. Texto corrido,
horas e navegação mantêm uma fonte simples para facilitar a leitura.

## Composição

- Cabeçalho com marca tipográfica e monograma circular.
- Título principal amplo, alinhado à esquerda.
- Ilustração de agenda com fundo alaranjado em arco.
- Secção de princípios com linhas finas e numeração.
- Botões de cantos discretos, espaçamento generoso e sem animações decorativas.

`AgendaPreview` é uma ilustração feita com HTML/CSS e dados locais fictícios.
Não é um calendário funcional, nem representa reservas reais. A legenda torna
essa distinção visível. A ilustração não adiciona bibliotecas ou imagens remotas.

O layout começa numa coluna e passa a duas em ecrãs largos. Esta identidade
será adaptada ao dashboard, onde a legibilidade e a densidade de informação
exigem títulos menores e áreas de trabalho mais compactas.

## Rever manualmente

- Página inicial, `/project` e endereço desconhecido.
- Larguras de 375 px, 768 px e desktop; zoom a 200%.
- Quebras do título e legibilidade dos textos da agenda.
- Navegação por teclado e estados de foco.
- Aparência da tipografia noutros sistemas operativos.

Commit sugerido: `style: introduce warm editorial visual identity`.

# Fase 1 — Base do frontend

O visual foi revisto na fase 1.1. Consulta a [direção visual](visual-direction.md)
para a paleta quente, tipografia e composição atuais.

## Objetivo e limites

Preparar React, TypeScript, Tailwind e navegação. Esta fase não implementa
autenticação, Supabase, reservas, dashboard ou uma demonstração com dados.

## Estrutura e fluxo

```text
index.html
  → src/main.tsx
    → BrowserRouter
      → AppRouter
        → PublicLayout
          → Outlet → página correspondente ao URL
```

`main.tsx` verifica se existe o elemento HTML onde React vai renderizar.
Em vez de usar `!` para silenciar a possibilidade de `null`, tratamos o caso
explicitamente. `StrictMode` ajuda a detetar problemas de desenvolvimento.

`BrowserRouter` acompanha o endereço e o histórico do browser. `AppRouter`
associa `/` à página inicial, `/project` à página do projeto e `*` à página
não encontrada. `PublicLayout` contém a estrutura comum. `Outlet` é o lugar
onde React Router insere a página filha.

Nesta fase os dados são textos estáticos locais. Não há chamadas de rede
para dados de negócio, cache remoto ou sessão.

## Responsabilidades

- `app/router.tsx`: correspondência entre URLs e páginas.
- `app/layouts/public-layout.tsx`: navegação, conteúdo, rodapé, título e foco.
- `features/home/pages`: conteúdo das páginas públicas iniciais.
- `features/home/components/feature-card.tsx`: cartão específico desta feature.
- `components/ui`: apresentação reutilizável entre features.
- `components/feedback`: página para um endereço desconhecido.
- `styles/globals.css`: integração Tailwind e tokens visuais.

Não criámos pastas vazias para funcionalidades futuras. `lib`, Supabase e
providers de dados serão adicionados quando existir uma responsabilidade real.

## Componentes e tipos

As props são os dados de entrada de um componente. `PageHeading` recebe
`eyebrow`, `title` e `description`, todos obrigatoriamente strings. O componente
é responsável pela apresentação e pelo título principal da página.

`ActionLink` usa `LinkProps`, fornecido pelo Router. `Omit<LinkProps, 'className'>`
reutiliza essas props, retirando a classe externa para manter estilos consistentes.
A propriedade `variant` aceita apenas `'primary'` ou `'secondary'`; o valor
predefinido é `'primary'`. Isto evita variantes com erros de escrita.

O componente produz um link: navegar é diferente de executar uma ação.
Quando criarmos formulários, teremos um componente `Button` próprio.

`FeatureCard` recebe dados de uma lista através de props. `map` transforma cada
item num cartão; `key` identifica cada item para React. Evitamos repetir o mesmo
bloco de marcação três vezes.

## Tailwind e tema

O plugin `@tailwindcss/vite` gera o CSS necessário ao build.
`@import 'tailwindcss'` ativa a integração. `@theme` define tokens como
`--color-brand`, que disponibiliza classes como `bg-brand` e `text-brand`.

Exemplo: `grid` com `lg:grid-cols-[1.15fr_1fr]` começa com uma coluna e muda
para duas colunas proporcionais em ecrãs largos. Esta abordagem começa pelo ecrã pequeno.

As classes das variantes são strings completas. Construir uma classe com
fragmentos como `bg-` mais uma cor pode impedir a deteção pelo Tailwind.

## Acessibilidade

- Idioma `pt-PT` no documento.
- Um `h1` por página e níveis de títulos coerentes.
- Navegação com nome acessível e indicação da rota ativa por `NavLink`.
- Link para saltar para o conteúdo principal.
- Foco visível nos elementos interativos.
- Ao mudar de página, o foco passa para o conteúdo e o título é atualizado.
- O primeiro carregamento preserva o comportamento normal do teclado.
- Links com destino real e informação explícita sobre o estado do produto.

## TypeScript e configuração

`strict` ativa verificações adicionais, incluindo valores possivelmente nulos
e parâmetros implicitamente tipados como `any`. Foi ativado para a aplicação
e para a configuração Vite.

`npm run build` verifica os tipos e depois gera `dist`. `npm run lint`
verifica padrões problemáticos com Oxlint. Nenhuma destas verificações substitui
experimentar a interface no browser.

## Ambiente e segurança

Esta fase não precisa de `.env`. `.env.example` documenta essa decisão.
O `.gitignore` ignora `.env` e `.env.*`, exceto o exemplo versionável.

Uma variável `VITE_*` é pública no browser. Ignorar `.env` no Git não transforma
uma variável de frontend num segredo. Credenciais privilegiadas nunca entram aqui.

## Verificação manual

1. Executar `npm run dev` e abrir o URL apresentado no terminal.
2. Navegar entre Apresentação e O projeto; testar voltar/avançar no browser.
3. Abrir diretamente `/project` e atualizar a página.
4. Abrir `/nao-existe` e usar o link de regresso.
5. Testar a 375 px e num ecrã largo, incluindo zoom a 200%.
6. Recarregar a página e usar Tab: o atalho para o conteúdo deve aparecer.
7. Seguir os links com teclado e verificar o foco e o título do separador.

A página não encontrada é apresentada pelo cliente. Não representa, por si só,
uma resposta HTTP 404. No deploy, o alojamento precisará de encaminhar as rotas
da SPA para `index.html`; configuraremos isso na etapa Vercel.

## Pequeno exercício

Adiciona temporariamente um quarto item a `features` em `home-page.tsx`.
Observa que aparece outro cartão sem alterar `FeatureCard`. Depois experimenta
uma variante inexistente em `ActionLink` e observa o erro de TypeScript.
Repõe os valores antes de continuar.

## Próxima fase

Preparar Supabase, migrations e o schema, explicando relações, constraints e RLS
antes de criar as tabelas. Instalar as dependências dessa fase apenas nessa altura.

Commit sugerido: `feat: set up frontend foundation and public navigation`.

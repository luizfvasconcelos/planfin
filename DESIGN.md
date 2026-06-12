---
name: PlanFin
description: Caderno de contas digital de um casal — fluxo de caixa mobile-first, tinta sobre papel.
colors:
  ink: "#111827"
  ink-soft: "#374151"
  ink-mute: "#9ca3af"
  paper: "#f9fafb"
  surface: "#ffffff"
  line: "#f3f4f6"
  line-strong: "#e5e7eb"
  positive: "#059669"
  negative: "#dc2626"
  info: "#2563eb"
  warning: "#d97706"
  live: "#22c55e"
  section-timeline: "#2563eb"
  section-fixas: "#d97706"
  section-gastos: "#9333ea"
  section-orcamento: "#e11d48"
  section-duda: "#16a34a"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  chip-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "4px 8px"
  chip-filter-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "4px 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item:
    textColor: "{colors.ink-mute}"
    typography: "{typography.label}"
  nav-item-active:
    textColor: "{colors.info}"
    typography: "{typography.label}"
---

# Design System: PlanFin

## 1. Overview

**Creative North Star: "O caderno de contas da casa"**

O PlanFin se lê como um caderno de contas de uma casa: tinta sobre papel. O fundo é um
cinza-papel calmo (`#f9fafb`), o conteúdo é tinta quase-preta (`#111827`), e a cor só
aparece onde carrega significado — dinheiro que entra, dinheiro que sai, e a etiqueta de
cada categoria. Nada é colorido por decoração. Essa contenção é o que diferencia o app de
uma planilha árida (sem hierarquia) e de um dashboard SaaS genérico (colorido por reflexo).

É um app feito à mão, para uma casa, usado no celular com uma mão só. A densidade é
confortável mas séria: títulos pequenos, valores em destaque com `tabular-nums`, listas que
respiram com divisores finos em vez de sombras. O calor vem do tom (português de quem mora
junto, a foto da Duda na navegação, "Duda" em vez de "Usuário B"), nunca de pastéis ou
ilustrações cartoon. Dinheiro é assunto sério; o caderno trata com cuidado e calma.

O sistema rejeita explicitamente quatro coisas: a **grade árida do Excel**, o **azul-marinho
frio de banco**, o **template SaaS** (cards idênticos, KPI gigante com gradiente, eyebrow
maiúsculo em toda seção) e o **excesso fofo/infantil**. Acolhedor não é infantil.

**Key Characteristics:**
- Papel-e-tinta: neutros sóbrios de base, cor só onde há significado.
- O estado ativo/selecionado é tinta preta sólida (`#111827`), não uma cor.
- Mobile-first de verdade: largura travada em `max-w-2xl`, bottom nav, alvos generosos.
- `tabular-nums` em todo valor monetário — os números são o conteúdo principal.
- Profundidade por borda fina (`#f3f4f6`) e camada tonal (papel vs. branco), quase sem sombra.
- Chips de duas cores como assinatura: tinta da etiqueta a 10% no fundo, cheia no texto.

## 2. Colors

Uma base neutra papel-e-tinta, com um vocabulário semântico estreito (positivo / negativo /
info / atenção) e uma cor de seção por área do app. Tudo o mais é cinza.

### Primary
- **Tinta** (`#111827`, gray-900): a cor do texto principal, dos valores monetários e — de
  forma deliberada — do **estado ativo/selecionado** (toggle escolhido, chip de filtro ligado,
  botão primário). No PlanFin "ativo" é preto sólido, não azul.

### Secondary
- **Info / Azul** (`#2563eb`, blue-600): estado informacional e de navegação — aba ativa no
  bottom nav, badge de filtros ativos, destaques de planejamento (`blue-50`). É a única cor
  que divide a função de "ativo" com a tinta, e só na navegação.

### Tertiary (cores de seção)
Cada área do app tem uma cor própria, usada só no ícone/acento da seção (home e nav), nunca
espalhada pela tela:
- **Timeline** (`#2563eb`, azul) · **Contas Fixas** (`#d97706`, âmbar) ·
  **Gastos** (`#9333ea`, roxo) · **Orçamento** (`#e11d48`, rosa) · **Duda** (`#16a34a`, verde).

### Semantic
- **Positivo** (`#059669`, emerald-600): dinheiro que entra, faturamento, gasto dentro do teto.
- **Negativo** (`#dc2626`, red-600): saldo negativo, estouro de orçamento, ações destrutivas.
- **Atenção** (`#d97706`, amber-600): aviso, perto do limite, contas fixas.
- **Online** (`#22c55e`, green-500): ponto pulsante de presença do outro usuário.

### Neutral
- **Papel** (`#f9fafb`, gray-50): fundo de toda página.
- **Superfície** (`#ffffff`): cards, headers, sheets — flutuam sobre o papel.
- **Tinta suave** (`#374151`, gray-700): corpo de texto secundário.
- **Tinta apagada** (`#9ca3af`, gray-400): rótulos, metadados, ícones inativos.
- **Linha** (`#f3f4f6`, gray-100): bordas de card e divisores de lista — o separador padrão.
- **Linha forte** (`#e5e7eb`, gray-200): bordas de input e contornos de chip inativo.

### A paleta de etiquetas
Categorias e formas de pagamento guardam sua própria cor, escolhida de uma paleta fixa de 12
matizes saturados (Tailwind-500): `#3b82f6 #10b981 #ec4899 #8b5cf6 #f97316 #ef4444 #eab308
#14b8a6 #6366f1 #06b6d4 #84cc16 #a855f7`. Essas cores existem para **distinguir entidades**,
não para decorar — sempre entram como ponto + chip de duas tintas, nunca como fundo cheio.

### Named Rules
**A Regra da Cor com Significado.** Cor só aparece quando responde a uma pergunta: isso é
entrada ou saída? estourei o teto? que categoria é esta? Se um elemento for colorido sem
responder a nada, ele volta para a tinta. O fundo nunca é colorido.

**A Regra da Tinta Ativa.** O estado selecionado é `#111827` sólido com texto branco. Azul é
reservado para navegação. Nunca pinte um item ativo com a cor da seção.

## 3. Typography

**Display / Body Font:** Geist (com `system-ui, sans-serif` de fallback)
**Mono:** Geist Mono — reservado; o efeito "monoespaçado" dos valores vem de `tabular-nums`
sobre o próprio Geist, não de trocar de família.

**Character:** Uma única família sans, geométrica e neutra, em pesos contrastantes. Um app de
produto não precisa de par display+body; o Geist carrega título, valor, corpo e rótulo. A
hierarquia vem de escala e peso, não de fontes diferentes.

### Hierarchy
- **Display** (800, 2.25rem/36px, line-height 1.1): só o letreiro "PlanFin" da tela inicial.
  Não aparece dentro do app.
- **Headline** (600, 1.25rem/20px, tabular-nums): valores-totais e KPIs ("Total do mês",
  saldo). O maior número de cada tela.
- **Title** (600, 1rem/16px): título de página no header e nomes de seção. Deliberadamente
  pequeno — é um header mobile, não um hero.
- **Body** (400, 0.875rem/14px, `#374151`): descrições, conteúdo de lista, texto padrão.
  Prosa corrida limitada a 65–75ch (raro neste app).
- **Label** (500, 0.75rem/12px, `#9ca3af`): metadados, rótulos de total, chips. Quando
  vira eyebrow de bloco usa `uppercase tracking-wide` — restrito a rótulos curtos, nunca em frase.
- **Micro** (500, 10–11px): contadores, percentuais, dia-da-semana no card de gasto.

### Named Rules
**A Regra dos Números Tabulares.** Todo valor monetário usa `tabular-nums`. Colunas de R$
alinham na vírgula e não "dançam" ao atualizar em tempo real. Os números são o produto.

## 4. Elevation

Sistema plano por princípio. A profundidade vem de **borda fina** (`#f3f4f6`) e de **camada
tonal** (cards brancos sobre papel `#f9fafb`), não de sombra. Sombra só aparece em superfícies
que de fato flutuam: o header fixo e o bottom nav (`shadow-sm`), e os cards da tela inicial
ganham `shadow-md` no hover como feedback de toque. Nada de sombras difusas grandes nem de
glassmorphism dentro do app.

### Shadow Vocabulary
- **Apoio** (`box-shadow: 0 1px 2px rgba(0,0,0,0.05)` — `shadow-sm`): header fixo e bottom nav,
  para separá-los do conteúdo que rola por baixo.
- **Hover** (`box-shadow: 0 4px 6px rgba(0,0,0,0.07)` — `shadow-md`): só nos cards-link da
  home, como resposta ao toque.

### Named Rules
**A Regra do Plano por Padrão.** Superfícies são planas em repouso. Se você está alcançando
uma sombra para "dar destaque" a um card de conteúdo, use uma borda `#f3f4f6` ou o fundo
papel `#f9fafb` em vez disso. Sombra é resposta a estado (fixar, flutuar, hover), não enfeite.

## 5. Components

### Buttons
- **Shape:** cantos suaves de 8px (`rounded-lg`) em botões; ícone-botões idem.
- **Primary:** tinta sólida `#111827` com texto branco (`bg-gray-900 text-white`). É o estado
  "escolhido" do toggle segmentado e do chip de filtro, além do CTA forte.
- **Ghost / Adicionar:** ação de "Novo item" é um botão de **borda tracejada** (`border-dashed
  border-gray-200`, texto `#6b7280`) ocupando a largura — convida sem competir com o conteúdo.
- **Icon button:** `#9ca3af` em repouso → `#374151` no hover, `rounded-lg`, área de toque ≥40px.
- **Destructive:** fundo `red-50` com texto `#dc2626` (nunca vermelho cheio para uma ação comum).
- **Hover / Focus:** `transition-colors` (150–200ms). Foco visível herdado do `focus-visible`
  do primitivo (anel `ring`), nunca removido.

### Chips
- **Etiqueta (categoria / forma):** a assinatura visual do app. Fundo é a cor da etiqueta a
  ~10% de opacidade (`${cor}1a`), texto e ponto na cor cheia. Pílula `rounded`. Subcategoria
  vem como "Mãe › Filha": a mãe saturada ancora a cor, a filha entra apagada (`opacity-55`).
- **Filtro:** pílula `rounded-full` com borda. Inativo = `bg-white text-gray-600 border-gray-200`
  (+ ponto de cor da entidade). Ativo = `bg-gray-900 text-white border-gray-900`.
- **Responsável / contador:** neutro discreto — `bg-gray-100 text-gray-400`, `rounded`.

### Cards / Containers
- **Corner Style:** 12px (`rounded-xl`) é o card padrão; 16px (`rounded-2xl`) nos cards da home.
- **Background:** branco `#ffffff` sobre o papel `#f9fafb`.
- **Border:** sempre `1px solid #f3f4f6`. A borda é o que separa, não a sombra.
- **Shadow Strategy:** nenhuma em repouso (ver Elevation).
- **Internal Padding:** 16px (`px-4`); linhas de lista usam `px-4 py-2`.
- **Listas:** um único card com `overflow-hidden`; as linhas se dividem por `border-b
  border-gray-100`, com `last:border-0`. Cabeçalho de grupo em `bg-gray-50`.

### Inputs / Fields
- **Style:** fundo branco, borda `#e5e7eb`, cantos 8px (`rounded-md`).
- **Focus:** anel `ring` do token; sem glow colorido.
- **Error:** borda/anel `destructive`; mensagem em `#dc2626`.

### Navigation
- **Bottom nav:** barra fixa, branca, borda superior `#f3f4f6`, 6 abas, respeita
  `env(safe-area-inset-bottom)`. Cada aba: ícone (20px) + rótulo 10px.
- **States:** inativo `#9ca3af` → hover `#4b5563`; **ativo `#2563eb`** (a aba da Duda usa a foto
  dela com anel azul quando ativa). Todo o app vive sob `max-w-2xl mx-auto` e `pb-32` para não
  ficar atrás da nav.

### Signature: Card de gasto
Linha de duas alturas. Esquerda: bloco de data (dia-da-semana micro + número em 16px semibold).
Direita: linha 1 = descrição (truncada) + valor (semibold, tabular-nums, com % opcional na view
"Maiores"); linha 2 = chips de categoria, forma e responsável ocupando a largura. Toda a linha
é um `<button>` com `hover:bg-gray-50`.

### Signature: Barra de progresso
Convenção única de dashboard: trilho `h-1.5`/`h-2` em `bg-gray-100 rounded-full overflow-hidden`,
preenchimento por `width: ${pct}%` inline na cor semântica (positivo / atenção / negativo
conforme o quanto do teto foi usado). Gráficos de barra são desenhados à mão (sem lib), pela
mesma regra: cada visual responde uma pergunta.

## 6. Do's and Don'ts

### Do:
- **Do** manter o fundo papel `#f9fafb` e cards brancos com borda `#f3f4f6`. Separe por borda
  e tom, não por sombra.
- **Do** usar `tabular-nums` em todo R$, com a tinta `#111827` em peso semibold para o valor.
- **Do** reservar cor para significado: verde entra, vermelho sai, azul navega, âmbar avisa.
- **Do** pintar o estado ativo/selecionado de **tinta preta sólida** (`bg-gray-900 text-white`).
- **Do** usar o chip de duas tintas (cor a 10% no fundo, cheia no texto) para categorias e formas.
- **Do** projetar para o polegar: `max-w-2xl`, bottom nav, alvos ≥40px, `pb-32` de respiro.
- **Do** manter o mesmo vocabulário (card, chip, toggle, total) em Timeline, Gastos, Orçamento,
  Fixas e Duda. Inconsistência entre telas é bug de design.

### Don't:
- **Don't** entregar a **grade árida do Excel**: números soltos sem hierarquia nem respiro.
- **Don't** virar **app de banco frio**: azul-marinho institucional, tom corporativo e distante.
- **Don't** cair no **template SaaS**: cards idênticos repetidos, KPI gigante com gradiente,
  eyebrow maiúsculo tracked acima de cada seção, roxo de bootstrap.
- **Don't** exagerar no **fofo/infantil**: pastéis em excesso, ilustrações cartoon, emojis por
  toda parte. Acolhedor vem do tom, não de enfeite.
- **Don't** usar `background-clip: text` com gradiente (texto-gradiente) nem glassmorphism
  decorativo dentro do app.
- **Don't** pintar de cinza-claro texto de corpo sobre fundo claro: corpo ≥ 4.5:1. Use
  `#374151`+ para texto lido, não `#9ca3af` (esse é só metadado).
- **Don't** usar `border-left`/`border-right` colorida >1px como faixa de acento. Use borda
  inteira, fundo tonal ou o ponto/chip de cor.
- **Don't** sinalizar só por cor: saldo negativo, estouro e status sempre reforçam com texto,
  ícone ou peso (segurança para daltonismo).

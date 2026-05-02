# PlanFin

> App de fluxo de caixa para casal — PWA mobile-first com sincronização em tempo real.

PlanFin substitui uma planilha Excel de controle financeiro compartilhada entre duas pessoas. O foco é **forecast de fluxo de caixa**: visualizar dias futuros, registrar entradas e saídas, e identificar antecipadamente quando o saldo fica negativo.

---

## Funcionalidades

### Timeline
- Uma linha por dia entre `start_date` e `end_date` (configurável)
- Dias **com** movimentação: card com entrada, saída, saldo acumulado e descrição
- Dias **sem** movimentação: linha minimalista, apenas data e dia da semana
- Hoje sempre destacado visualmente
- Fins de semana com fundo sutilmente diferenciado
- Saldo acumulado negativo: data em vermelho suave
- ⚠️ aparece apenas no dia em que o saldo cruza zero pela primeira vez

### Edição
- Tap/click em qualquer linha abre um bottom sheet com campos: entrada, saída, descrição
- Ícone de borracha no rodapé limpa todos os campos de uma vez
- Salvar com tudo zerado deleta a linha do banco automaticamente
- Saldo inicial editável inline no header (clique no valor)

### Radar
- Bloco de notas independente da timeline — sem cálculos, sem integração com saldo
- Duas seções: **Radar de Entradas** e **Radar de Saídas**
- Cada item tem: descrição, previsão (texto livre) e valor (BRL)
- Remoção com confirmação inline (dois taps)
- Acessado pelo ícone de radar no header

### Gerenciamento de período
- **Remover dias do início**: define nova data inicial, deleta entradas anteriores (irreversível, com confirmação)
- **Adicionar dias ao final**: estende o range por N dias

### Colaboração em tempo real
- Supabase Realtime sincroniza `entries`, `settings` e `radar_items` entre os dois usuários
- Indicador de presença no header: mostra quando o outro usuário está online
- Estratégia last-write-wins (sem lock de edição)

### PWA
- Installável como app no Android e iOS ("Adicionar à tela inicial")
- Service worker com cache network-first
- Leitura offline com dados da última sessão

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Estilo | Tailwind CSS + shadcn/ui |
| Backend | Supabase (Auth + Postgres + Realtime) |
| Deploy | Vercel |
| PWA | Web App Manifest + Service Worker |

---

## Arquitetura

### Visão geral

```
Browser (PWA)
  └── Next.js App Router (client components)
        ├── Supabase Browser Client  ──► Postgres (RLS)
        └── Supabase Realtime        ──► Postgres Changes + Presence
```

O app é inteiramente client-side após o carregamento inicial. Não há Server Actions nem API Routes — toda comunicação com o banco ocorre direto do browser via `@supabase/ssr`.

A proteção de rotas é feita por `proxy.ts` (equivalente ao `middleware.ts` em versões anteriores do Next.js), que verifica a sessão em cada request e redireciona para `/login` se não autenticado.

### Fluxo de dados

```
Supabase DB
    │
    ├── settings (1 linha)     ──► saldo_inicial, start_date, end_date
    └── entries (N linhas)     ──► uma por dia com movimentação
    └── radar_items (N linhas) ──► itens do bloco de notas Radar

app/page.tsx
    ├── fetchAll() busca settings + entries
    ├── buildRows() gera o array de DayRow (dias reais + dias virtuais)
    │     └── dias sem entry no DB são gerados em memória com valores zerados
    └── Realtime subscription re-executa fetchAll() a cada mudança
```

### Cálculo do saldo acumulado

O saldo acumulado **nunca é persistido** — é sempre recalculado em runtime na função `buildRows()`:

```
acumulado[0] = saldo_inicial + entrada[0] - saida[0]
acumulado[n] = acumulado[n-1] + entrada[n] - saida[n]
```

Isso garante que alterar o `saldo_inicial` recalcula tudo instantaneamente no frontend, sem nenhuma query adicional.

### Inicialização lazy do cliente Supabase

O `createBrowserClient` do `@supabase/ssr` exige variáveis de ambiente em runtime. Para evitar erro durante o build estático (quando as env vars não estão disponíveis), o cliente é inicializado de forma lazy via `useRef`:

```ts
const sbRef = useRef<SupabaseClient | null>(null)
const sb = useCallback(() => {
  if (!sbRef.current) sbRef.current = createClient()
  return sbRef.current
}, [])
```

O cliente só é criado no primeiro render no browser, nunca no servidor.

---

## Modelo de dados

### `settings`
Tabela singleton (sempre exatamente 1 linha, `id = 1`).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | int | PK, sempre 1 (CHECK constraint) |
| `saldo_inicial` | numeric | Saldo de abertura do período |
| `start_date` | date | Primeiro dia exibido na timeline |
| `end_date` | date | Último dia exibido na timeline |
| `updated_at` | timestamptz | Atualizado automaticamente por trigger |

### `entries`
Uma linha por dia **que tem movimentação**. Dias sem movimentação não existem no banco — são gerados virtualmente no frontend.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `date` | date | UNIQUE — um registro por dia |
| `entrada` | numeric | Valor de entradas do dia |
| `saida` | numeric | Valor de saídas do dia |
| `descricao` | text | Descrição livre (ex: "salário/aluguel") |
| `updated_by` | uuid | FK para `auth.users` |
| `updated_at` | timestamptz | Atualizado automaticamente por trigger |

### `radar_items`
Bloco de notas independente da timeline.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `tipo` | text | `'entrada'` ou `'saida'` (CHECK constraint) |
| `item` | text | Descrição do item |
| `previsao` | text | Previsão em texto livre (ex: "junho", "fim do ano") |
| `valor` | numeric | Valor aproximado |
| `created_at` | timestamptz | Data de criação |

### RLS
Todas as tabelas têm RLS habilitado. A política é simples: qualquer usuário autenticado tem acesso total (SELECT/INSERT/UPDATE/DELETE). O controle de acesso é feito pela autenticação — apenas os 2 usuários cadastrados conseguem logar.

---

## Estrutura de arquivos

```
planfin/
├── app/
│   ├── layout.tsx              # Metadata PWA, registro do service worker
│   ├── page.tsx                # Página principal: estado, Realtime, handlers
│   └── login/
│       └── page.tsx            # Formulário de login
│
├── components/
│   ├── settings-header.tsx     # Header fixo: saldo inicial + ícone Radar
│   ├── timeline-table.tsx      # Lista de dias com timeline vertical
│   ├── entry-edit-sheet.tsx    # Bottom sheet de edição por dia
│   ├── range-manager.tsx       # Botões de gerenciamento do período
│   ├── radar-sheet.tsx         # Sheet do Radar (bloco de notas)
│   ├── sw-register.tsx         # Registro do service worker (client-only)
│   └── ui/                     # Componentes shadcn/ui
│
├── lib/
│   ├── types.ts                # Interfaces: Settings, Entry, DayRow, RadarItem
│   ├── utils.ts                # formatBRL, parseDecimal, dateRange, getDayOfWeek…
│   └── supabase/
│       ├── client.ts           # createBrowserClient (uso client-side)
│       ├── server.ts           # createServerClient (uso server-side)
│       └── middleware.ts       # updateSession (lida com cookies de auth)
│
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker (cache network-first)
│   ├── icon-192.png            # Ícone PWA 192×192
│   └── icon-512.png            # Ícone PWA 512×512
│
├── supabase/migrations/
│   ├── 001_initial_schema.sql  # Tabelas settings + entries, RLS, triggers
│   └── 002_radar.sql           # Tabela radar_items, RLS
│
├── .github/workflows/
│   └── keep-alive.yml          # Ping ao Supabase a cada 5 dias
│
├── proxy.ts                    # Proteção de rotas (Next.js 16+)
└── .env.local.example          # Template de variáveis de ambiente
```

---

## Setup local

### Pré-requisitos
- Node.js 18+
- Conta no [Supabase](https://supabase.com)

### 1. Clonar e instalar

```bash
git clone <url-do-repo>
cd planfin
npm install
```

### 2. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **Project Settings → API** e copie:
   - **Project URL**
   - **Publishable key** — sistema novo, começa com `sb_publishable_...`

> ⚠️ Use o sistema **novo** de API keys (Publishable/Secret). Não use o legacy `anon`/`service_role`.

3. No **SQL Editor**, execute as migrations em ordem:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_radar.sql`

4. Em **Authentication → Users**, crie os 2 usuários (email + senha)

5. Opcional: em **Authentication → Configuration**, desabilite "Enable email confirmations" para login direto sem verificação de e-mail

### 3. Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Edite `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### 4. Rodar

```bash
npm run dev
```

Acesse `http://localhost:3000`

---

## Deploy

### Vercel

1. Suba o repositório no GitHub
2. Importe o projeto na [Vercel](https://vercel.com)
3. Em **Settings → Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy automático a cada push na branch `main`

### Keep-alive (Supabase Free Tier)

O Supabase pausa projetos inativos no free tier. O workflow `.github/workflows/keep-alive.yml` faz um ping HTTP a cada 5 dias para evitar isso.

Configure os secrets no GitHub (**Settings → Secrets and variables → Actions**):
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

### Ícones PWA

Os ícones em `public/icon-192.png` e `public/icon-512.png` são placeholders gerados automaticamente. Para produção, substitua por imagens 192×192 e 512×512 com a identidade visual do app.

Para regenerar os placeholders:
```bash
node scripts/generate-icons.mjs
```

---

## Decisões técnicas relevantes

**Por que não há Server Actions ou API Routes?**
O app tem apenas 2 usuários com acesso total aos dados. A simplicidade de chamar o Supabase diretamente do cliente supera qualquer benefício de uma camada de API intermediária.

**Por que `proxy.ts` e não `middleware.ts`?**
Next.js 16 renomeou a convenção de arquivo de `middleware.ts` para `proxy.ts`. A função exportada também mudou de `middleware` para `proxy`.

**Por que dias vazios não são salvos no banco?**
Reduz drasticamente o volume de dados. Um range de 90 dias com 10 dias com movimentação gera 10 linhas, não 90. O frontend reconstrói a sequência completa em memória via `buildRows()`.

**Por que o saldo acumulado não é persistido?**
Qualquer alteração no `saldo_inicial` ou em qualquer dia anterior invalidaria todos os valores subsequentes. Manter o cálculo em runtime elimina esse problema e garante consistência.

**Realtime com `fetchAll()` em vez de patch incremental**
Optou-se por re-buscar todos os dados a cada evento de Realtime. Com um dataset pequeno (no máximo algumas centenas de linhas), isso é mais simples e mais seguro do que aplicar patches incrementais que podem gerar inconsistências.

---

## Fora do escopo (v1)

- Categorias de transação
- Múltiplas transações por dia
- Notificações push
- Exportação para Excel
- Gráficos
- Histórico/auditoria
- Tema escuro

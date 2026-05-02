# PlanFin

App de fluxo de caixa para casal — PWA mobile-first com sincronização em tempo real.

## Stack

- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS + shadcn/ui
- Supabase (Auth + Postgres + Realtime)
- Vercel (deploy)

---

## Setup

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **Project Settings → API** e copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (sistema novo, começa com `sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   > ⚠️ Use o sistema **novo** de API keys (Publishable/Secret), não o legacy anon/service_role.
3. No **SQL Editor**, rode o conteúdo de `supabase/migrations/001_initial_schema.sql`
4. Em **Authentication → Users**, crie os 2 usuários manualmente (email + senha)
5. Em **Authentication → Configuration**, desabilite "Enable email confirmations" se quiser login direto

### 2. Variáveis de ambiente

```bash
cp .env.local.example .env.local
# Edite .env.local com os valores do Supabase
```

### 3. Instalar e rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`

### 4. Ícones PWA

Coloque dois arquivos em `/public`:
- `icon-192.png` — 192×192 px
- `icon-512.png` — 512×512 px

### 5. Deploy na Vercel

1. Suba o repo no GitHub
2. Conecte o repo na Vercel
3. Em **Settings → Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy automático a cada push na `main`

### 6. GitHub Secrets para keep-alive

Em **GitHub → Settings → Secrets and variables → Actions**, adicione:
- `SUPABASE_URL` — a mesma URL do projeto Supabase
- `SUPABASE_PUBLISHABLE_KEY` — a publishable key

O workflow `.github/workflows/keep-alive.yml` faz um ping a cada 5 dias para evitar que o projeto pause no free tier.

---

## Funcionalidades

- Login com email + senha
- Timeline de dias com saldo acumulado
- Edição de entrada, saída e descrição por dia
- Saldo inicial editável no header
- Saldo final projetado calculado automaticamente
- Acumulado negativo destacado em vermelho
- Hoje destacado visualmente
- Sincronização em tempo real (Supabase Realtime)
- Indicador de presença ("Fulana online agora")
- Gerenciar range: remover dias do início / adicionar dias ao final
- PWA installável no Android/iOS
- Cache offline para leitura
- Formato BRL (R$) em todos os campos numéricos (aceita vírgula ou ponto)
- Datas em pt-BR (DD/MM/YYYY) e dias da semana em português

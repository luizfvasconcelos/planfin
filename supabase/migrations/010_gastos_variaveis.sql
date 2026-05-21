-- Gastos Variáveis: registro detalhado de gastos do dia-a-dia,
-- separado da timeline de fluxo de caixa (não soma em entries.saida).

-- Categorias de gasto (alimentação, deslocamento, lazer, etc.)
-- "ativa" funciona como soft-delete: categorias com gastos antigos vinculados
-- ficam preservadas (FK RESTRICT), mas saem das listas de seleção.
create table if not exists public.categorias_gasto (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cor         text not null default '#3b82f6',
  icone       text,
  position    int not null default 0,
  ativa       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.categorias_gasto enable row level security;

create policy "auth_full_categorias_gasto" on public.categorias_gasto
  for all to authenticated using (true) with check (true);

create trigger categorias_gasto_updated_at
  before update on public.categorias_gasto
  for each row execute function public.set_updated_at();

-- Formas de pagamento (Nubank, Itaú, Pix, Dinheiro, etc.) — mesmo formato.
create table if not exists public.formas_pagamento (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cor         text not null default '#3b82f6',
  icone       text,
  position    int not null default 0,
  ativa       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.formas_pagamento enable row level security;

create policy "auth_full_formas_pagamento" on public.formas_pagamento
  for all to authenticated using (true) with check (true);

create trigger formas_pagamento_updated_at
  before update on public.formas_pagamento
  for each row execute function public.set_updated_at();

-- Gastos variáveis: uma linha por gasto realizado.
-- responsavel é enum por CHECK: 'luiz' | 'duda' | 'casal' (gasto compartilhado).
-- FK com RESTRICT pra impedir delete de categoria/forma que tem gastos vinculados;
-- desativação se dá via flag "ativa" das tabelas pai.
create table if not exists public.gastos_variaveis (
  id                   uuid primary key default gen_random_uuid(),
  date                 date not null,
  valor                numeric not null check (valor > 0),
  categoria_id         uuid not null references public.categorias_gasto(id) on delete restrict,
  forma_pagamento_id   uuid not null references public.formas_pagamento(id) on delete restrict,
  responsavel          text not null check (responsavel in ('luiz', 'duda', 'casal')),
  descricao            text,
  updated_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists gastos_variaveis_date_idx
  on public.gastos_variaveis(date);
create index if not exists gastos_variaveis_categoria_idx
  on public.gastos_variaveis(categoria_id);
create index if not exists gastos_variaveis_forma_pagamento_idx
  on public.gastos_variaveis(forma_pagamento_id);

alter table public.gastos_variaveis enable row level security;

create policy "auth_full_gastos_variaveis" on public.gastos_variaveis
  for all to authenticated using (true) with check (true);

create trigger gastos_variaveis_updated_at
  before update on public.gastos_variaveis
  for each row execute function public.set_updated_at();

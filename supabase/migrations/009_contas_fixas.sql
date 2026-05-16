-- Contas fixas: itens recorrentes (aluguel, internet, escola, cartão, etc.)
create table if not exists public.contas_fixas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  position     int not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.contas_fixas enable row level security;

create policy "auth_full_contas_fixas" on public.contas_fixas
  for all to authenticated using (true) with check (true);

create trigger contas_fixas_updated_at
  before update on public.contas_fixas
  for each row execute function public.set_updated_at();

-- Vigências: valor padrão de uma conta para um período (mes_inicio..mes_fim)
-- mes_inicio e mes_fim sempre representam o primeiro dia do mês.
-- mes_fim nulo = vigência aberta (vale até o "infinito").
create table if not exists public.contas_fixas_vigencias (
  id           uuid primary key default gen_random_uuid(),
  conta_id     uuid not null references public.contas_fixas(id) on delete cascade,
  mes_inicio   date not null,
  mes_fim      date,
  valor        numeric not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (mes_fim is null or mes_fim >= mes_inicio)
);

create index if not exists contas_fixas_vigencias_conta_idx
  on public.contas_fixas_vigencias(conta_id);

alter table public.contas_fixas_vigencias enable row level security;

create policy "auth_full_contas_fixas_vigencias" on public.contas_fixas_vigencias
  for all to authenticated using (true) with check (true);

create trigger contas_fixas_vigencias_updated_at
  before update on public.contas_fixas_vigencias
  for each row execute function public.set_updated_at();

-- Células: estado por (conta, mês). Guarda overrides manuais e o estado de "pago".
-- mes sempre o primeiro dia do mês.
-- valor_override nulo = célula herda da vigência ativa (se houver).
create table if not exists public.contas_fixas_celulas (
  id              uuid primary key default gen_random_uuid(),
  conta_id        uuid not null references public.contas_fixas(id) on delete cascade,
  mes             date not null,
  valor_override  numeric,
  pago            boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (conta_id, mes)
);

create index if not exists contas_fixas_celulas_conta_idx
  on public.contas_fixas_celulas(conta_id);
create index if not exists contas_fixas_celulas_mes_idx
  on public.contas_fixas_celulas(mes);

alter table public.contas_fixas_celulas enable row level security;

create policy "auth_full_contas_fixas_celulas" on public.contas_fixas_celulas
  for all to authenticated using (true) with check (true);

create trigger contas_fixas_celulas_updated_at
  before update on public.contas_fixas_celulas
  for each row execute function public.set_updated_at();

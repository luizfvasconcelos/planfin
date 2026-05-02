-- Settings: single row config (id always = 1)
create table if not exists public.settings (
  id          int primary key default 1 check (id = 1),
  saldo_inicial numeric not null default 0,
  start_date  date not null default current_date,
  end_date    date not null default (current_date + interval '60 days'),
  updated_at  timestamptz not null default now()
);

-- Seed the single settings row
insert into public.settings (id, saldo_inicial, start_date, end_date)
values (1, 0, current_date, current_date + interval '60 days')
on conflict (id) do nothing;

-- Entries: one row per day that has movement
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique,
  entrada     numeric not null default 0,
  saida       numeric not null default 0,
  descricao   text not null default '',
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);

-- Enable RLS
alter table public.settings enable row level security;
alter table public.entries  enable row level security;

-- Policies: any authenticated user has full access
create policy "auth_full_settings" on public.settings
  for all to authenticated using (true) with check (true);

create policy "auth_full_entries" on public.entries
  for all to authenticated using (true) with check (true);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

create trigger entries_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

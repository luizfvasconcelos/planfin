-- Produção diária da Duda por clínica
create table if not exists public.duda_entries (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  clinica_id  uuid not null references public.duda_clinicas(id),
  valor       numeric not null default 0,
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists duda_entries_date_idx on public.duda_entries(date);
create index if not exists duda_entries_clinica_idx on public.duda_entries(clinica_id);

alter table public.duda_entries enable row level security;

create policy "auth_full_duda_entries" on public.duda_entries
  for all to authenticated using (true) with check (true);

create trigger duda_entries_updated_at
  before update on public.duda_entries
  for each row execute function public.set_updated_at();

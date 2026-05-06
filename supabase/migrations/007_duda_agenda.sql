-- Agenda semanal recorrente: para cada (clínica, dia da semana),
-- define se é dia de "diária" (com mínimo) ou "produção".
create table if not exists public.duda_agenda (
  id          uuid primary key default gen_random_uuid(),
  weekday     int  not null check (weekday >= 0 and weekday <= 6),  -- 0=domingo
  clinica_id  uuid not null references public.duda_clinicas(id) on delete cascade,
  tipo        text not null default 'producao' check (tipo in ('diaria', 'producao')),
  minimo      numeric,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (clinica_id, weekday)
);

create index if not exists duda_agenda_weekday_idx on public.duda_agenda(weekday);

alter table public.duda_agenda enable row level security;

create policy "auth_full_duda_agenda" on public.duda_agenda
  for all to authenticated using (true) with check (true);

create trigger duda_agenda_updated_at
  before update on public.duda_agenda
  for each row execute function public.set_updated_at();

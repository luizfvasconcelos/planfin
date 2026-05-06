-- Datas em que a Duda NÃO vai trabalhar (sobrepõe a agenda padrão).
-- Cobrir: feriados, especialização, dias de folga.
create table if not exists public.duda_dia_off (
  date        date primary key,
  created_at  timestamptz not null default now()
);

alter table public.duda_dia_off enable row level security;

create policy "auth_full_duda_dia_off" on public.duda_dia_off
  for all to authenticated using (true) with check (true);

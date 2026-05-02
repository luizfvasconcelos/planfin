create table if not exists public.radar_items (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('entrada', 'saida')),
  item       text not null,
  previsao   text not null default '',
  valor      numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.radar_items enable row level security;

create policy "auth_full_radar" on public.radar_items
  for all to authenticated using (true) with check (true);

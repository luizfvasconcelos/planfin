-- Clínicas onde a Duda trabalha
create table if not exists public.duda_clinicas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  sigla       text,
  cor         text not null default '#3b82f6',
  position    int not null default 0,
  ativa       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.duda_clinicas enable row level security;

create policy "auth_full_duda_clinicas" on public.duda_clinicas
  for all to authenticated using (true) with check (true);

create trigger duda_clinicas_updated_at
  before update on public.duda_clinicas
  for each row execute function public.set_updated_at();

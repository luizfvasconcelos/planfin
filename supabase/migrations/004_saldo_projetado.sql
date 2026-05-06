-- Add projected balance + active mode to settings
alter table public.settings
  add column if not exists saldo_projetado numeric not null default 0,
  add column if not exists saldo_modo text not null default 'atual'
    check (saldo_modo in ('atual', 'projetado'));

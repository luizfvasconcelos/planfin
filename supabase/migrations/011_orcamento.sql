-- Orçamento: sequência de períodos com teto de gasto. Cada orçamento é
-- independente; gastos variáveis no período (não excluídos) contam para
-- o consumo do teto.

create table if not exists public.orcamentos (
  id            uuid primary key default gen_random_uuid(),
  data_inicio   date not null,
  data_fim      date not null,
  valor_teto    numeric not null check (valor_teto > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create index if not exists orcamentos_data_inicio_idx
  on public.orcamentos(data_inicio);

alter table public.orcamentos enable row level security;

create policy "auth_full_orcamentos" on public.orcamentos
  for all to authenticated using (true) with check (true);

create trigger orcamentos_updated_at
  before update on public.orcamentos
  for each row execute function public.set_updated_at();

-- Flag global no gasto: quando true, o gasto não conta em nenhum orçamento.
-- Útil pra gastos pontuais que não deveriam pesar no controle (reembolso,
-- presente recebido por terceiros, etc.). A flag aparece no sheet de edição
-- do gasto e também tem toggle direto na lista de orçamento.
alter table public.gastos_variaveis
  add column if not exists excluido_orcamento boolean not null default false;

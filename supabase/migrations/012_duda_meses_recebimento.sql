-- Prazo de recebimento por entrada da Duda.
-- 0 (default) = recebe na própria data; N > 0 = recebe no mês +N.
-- Permite quebrar um dia de atendimento em N linhas com prazos diferentes
-- (ex: atendeu Amil e MetLife no mesmo dia/clínica, cada plano paga em
-- um mês diferente).
alter table public.duda_entries
  add column if not exists meses_recebimento int not null default 0
  check (meses_recebimento >= 0);

-- Subcategorias de gasto: uma categoria pode ter uma categoria-mãe.
-- Sub = linha em categorias_gasto com parent_id preenchido. O gasto continua
-- com um único categoria_id (apontando pra mãe ou pra filha); agregações
-- "por categoria" rolam pra raiz no app. Profundidade máxima de 1 nível
-- (sub não tem filhos) — garantida pela UI, não por constraint.
-- Cor da sub é herdada da mãe na exibição (a coluna cor fica redundante).

alter table public.categorias_gasto
  add column if not exists parent_id uuid
    references public.categorias_gasto(id) on delete restrict;

create index if not exists categorias_gasto_parent_id_idx
  on public.categorias_gasto(parent_id);

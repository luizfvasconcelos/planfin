import type { CategoriaGasto } from "./types"

// Helpers de categoria/subcategoria. Sub = categoria com parent_id (1 nível).
// O gasto guarda um único categoria_id (mãe ou filha); agregações "por
// categoria" rolam pra raiz com rootOf/rootIdOf.

// != null cobre undefined (banco ainda sem a coluna) além de null.
export function isSub(c: CategoriaGasto): boolean {
  return c.parent_id != null
}

export function rootsOf(categorias: CategoriaGasto[]): CategoriaGasto[] {
  return categorias.filter((c) => !isSub(c))
}

// Subcategorias agrupadas por mãe, na ordem em que aparecem na lista.
export function subsByParent(categorias: CategoriaGasto[]): Map<string, CategoriaGasto[]> {
  const map = new Map<string, CategoriaGasto[]>()
  for (const c of categorias) {
    if (!c.parent_id) continue
    if (!map.has(c.parent_id)) map.set(c.parent_id, [])
    map.get(c.parent_id)!.push(c)
  }
  return map
}

// Categoria raiz de um id qualquer (mãe ou filha). Null se o id não existe.
export function rootOf(
  categoriaId: string,
  map: Map<string, CategoriaGasto>,
): CategoriaGasto | null {
  const c = map.get(categoriaId)
  if (!c) return null
  if (!c.parent_id) return c
  return map.get(c.parent_id) ?? c  // mãe inativa/ausente: trata a sub como raiz
}

export function rootIdOf(categoriaId: string, map: Map<string, CategoriaGasto>): string {
  return rootOf(categoriaId, map)?.id ?? categoriaId
}

// Cor de exibição: sub herda da mãe.
export function corOf(c: CategoriaGasto, map: Map<string, CategoriaGasto>): string {
  if (c.parent_id) return map.get(c.parent_id)?.cor ?? c.cor
  return c.cor
}

// "Deslocamento › Gasolina" pra sub; só o nome pra raiz.
export function labelOf(c: CategoriaGasto, map: Map<string, CategoriaGasto>): string {
  if (!c.parent_id) return c.nome
  const mae = map.get(c.parent_id)
  return mae ? `${mae.nome} › ${c.nome}` : c.nome
}

// Categoria pronta pra exibição em chip: sub vira "Mãe › Filha" com a cor da mãe.
export function displayCategoria(
  id: string,
  map: Map<string, CategoriaGasto>,
): CategoriaGasto | null {
  const c = map.get(id)
  if (!c) return null
  if (!c.parent_id) return c
  return { ...c, nome: labelOf(c, map), cor: corOf(c, map) }
}

// Rótulo usado na quebra pra gastos lançados direto na mãe.
export const NAO_CLASSIFICADO = "Não classificado"
